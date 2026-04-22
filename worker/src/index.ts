import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "./db/schema";
import { zipSync, strToU8 } from "fflate";

type Bindings = {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  JWT_SECRET: string;
  R2_PUBLIC_URL: string;
};

type Variables = {
  userId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// CORS
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["Content-Type", "Authorization"] }));

// Global error handler with CORS
app.onError((err, c) => {
  console.error("Worker error:", err.message);
  return c.json({ message: err.message || "서버 오류" }, 500);
});

// Auto-migrate: ensure attachments columns exist (safe - ALTER TABLE fails silently if column exists)
let migrated = false;
app.use("*", async (c, next) => {
  if (!migrated) {
    migrated = true;
    const raw = c.env.DB;
    try { await raw.prepare("ALTER TABLE inspections ADD COLUMN attachments TEXT").run(); } catch { /* already exists */ }
    try { await raw.prepare("ALTER TABLE defects ADD COLUMN attachments TEXT").run(); } catch { /* already exists */ }
    try { await raw.prepare("ALTER TABLE schedules ADD COLUMN attachments TEXT").run(); } catch { /* already exists */ }
    try { await raw.prepare("ALTER TABLE daily_logs ADD COLUMN attachments TEXT").run(); } catch { /* already exists */ }
    try { await raw.prepare("ALTER TABLE design_changes ADD COLUMN attachments TEXT").run(); } catch { /* already exists */ }
  }
  await next();
});

// --- JWT helpers (manual, no Node.js crypto dependency) ---
function base64url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToStr(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (b64.length % 4)) % 4);
  return atob(padded);
}

async function signJwt(payload: Record<string, unknown>, secret: string, expiresIn: number = 7 * 24 * 3600): Promise<string> {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresIn }));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigStr = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigStr}`;
}

async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = Uint8Array.from(base64urlToStr(parts[2]), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!valid) return null;
  const payload = JSON.parse(base64urlToStr(parts[1]));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

// --- Auth Middleware ---
app.use("/api/*", async (c, next) => {
  // Skip auth for login
  if (c.req.path === "/api/auth/login") return next();
  // Skip auth for photo file serving
  if (c.req.path.startsWith("/api/photos/file/")) return next();

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ message: "인증이 필요합니다" }, 401);
  }
  const token = authHeader.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload?.userId) {
    return c.json({ message: "유효하지 않은 토큰입니다" }, 401);
  }
  c.set("userId", payload.userId as string);
  return next();
});

// --- CLIENT 역할: 관리자 전용 쓰기 API 차단 ---
// 건축주(CLIENT)에게 허용된 쓰기 경로만 통과시킴
const CLIENT_ALLOWED_WRITE = [
  /^POST \/api\/auth\/logout$/,
  /^PATCH \/api\/auth\/change-password$/,
  /^POST \/api\/projects\/[^/]+\/requests$/, // 요청사항 등록
  /^PATCH \/api\/requests\/[^/]+$/,          // 요청사항 수정
  /^DELETE \/api\/requests\/[^/]+$/,         // 요청사항 삭제
  /^POST \/api\/requests\/[^/]+\/comments$/, // 댓글 등록
  /^PATCH \/api\/comments\/[^/]+$/,          // 댓글 수정
  /^DELETE \/api\/comments\/[^/]+$/,         // 댓글 삭제
];

app.use("/api/*", async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "OPTIONS" || method === "HEAD") return next();
  if (c.req.path === "/api/auth/login") return next();

  const user = await getCurrentUser(c);
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  if (user.role !== "CLIENT") return next();

  const sig = `${method} ${c.req.path}`;
  const allowed = CLIENT_ALLOWED_WRITE.some((re) => re.test(sig));
  if (!allowed) return c.json({ message: "권한이 없습니다" }, 403);
  return next();
});

// Helper to get DB
function getDb(c: { env: Bindings }) {
  return drizzle(c.env.DB, { schema });
}

// Helper: clean up R2 files + photos table for attachment URLs
async function cleanupAttachments(db: ReturnType<typeof getDb>, r2: R2Bucket, attachmentsJson: string | null) {
  if (!attachmentsJson) return;
  let urls: string[];
  try { urls = JSON.parse(attachmentsJson); if (!Array.isArray(urls)) return; } catch { return; }
  for (const url of urls) {
    // Delete from R2
    const r2Key = url.includes("/api/photos/file/") ? url.split("/api/photos/file/")[1] : null;
    if (r2Key) { try { await r2.delete(r2Key); } catch { /* ignore */ } }
    // Delete matching photo record
    try { await db.delete(schema.photos).where(eq(schema.photos.imageUrl, url)); } catch { /* ignore */ }
  }
}

// Helper: remove a photo URL from all attachments JSON across all tables
async function removeUrlFromAllAttachments(db: ReturnType<typeof getDb>, imageUrl: string) {
  const tables = [
    schema.schedules, schema.dailyLogs, schema.designChanges,
    schema.designChecks, schema.clientRequests, schema.inspections, schema.defects,
  ] as const;
  for (const tbl of tables) {
    try {
      const rows = await db.select().from(tbl);
      for (const row of rows) {
        const att = (row as any).attachments;
        if (!att) continue;
        try {
          const urls: string[] = JSON.parse(att);
          if (!Array.isArray(urls) || !urls.includes(imageUrl)) continue;
          const filtered = urls.filter((u) => u !== imageUrl);
          await db.update(tbl as any).set({ attachments: filtered.length ? JSON.stringify(filtered) : null } as any)
            .where(eq((tbl as any).id, (row as any).id));
        } catch { /* ignore parse errors */ }
      }
    } catch { /* ignore table errors */ }
  }
}

// Helper: clean up single photo from R2
async function cleanupPhotoR2(r2: R2Bucket, imageUrl: string) {
  const r2Key = imageUrl.includes("/api/photos/file/") ? imageUrl.split("/api/photos/file/")[1] : null;
  if (r2Key) { try { await r2.delete(r2Key); } catch { /* ignore */ } }
}

// Helper: get current user with role
async function getCurrentUser(c: any) {
  const db = getDb(c);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, c.get("userId")));
  return user;
}

// Helper: 건축주(CLIENT)는 관리자용 쓰기 API 접근 불가
async function requirePM(c: any): Promise<Response | null> {
  const user = await getCurrentUser(c);
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  if (user.role === "CLIENT") return c.json({ message: "권한이 없습니다" }, 403);
  return null;
}

// Helper: check if user has access to project (SUPER_ADMIN sees all, others need membership)
async function hasProjectAccess(c: any, projectId: string, requiredRoles?: string[]) {
  const user = await getCurrentUser(c);
  if (!user) return null;
  if (user.role === "SUPER_ADMIN") return user;
  const db = getDb(c);
  const [member] = await db.select().from(schema.projectMembers)
    .where(eq(schema.projectMembers.projectId, projectId));
  // Check all members for this project
  const members = await db.select().from(schema.projectMembers)
    .where(eq(schema.projectMembers.projectId, projectId));
  const myMembership = members.find((m) => m.userId === user.id);
  if (!myMembership) return null;
  if (requiredRoles && !requiredRoles.includes(myMembership.role)) return null;
  return user;
}

// --- Auth Routes ---
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json();
  const username = body.username || body.email;
  const password = body.password;
  if (!username || !password) return c.json({ message: "아이디와 비밀번호를 입력해주세요" }, 400);

  const db = getDb(c);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, username));
  if (!user) return c.json({ message: "아이디 또는 비밀번호가 일치하지 않습니다" }, 401);

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return c.json({ message: "아이디 또는 비밀번호가 일치하지 않습니다" }, 401);

  const token = await signJwt({ userId: user.id }, c.env.JWT_SECRET);
  const { password: _, ...safeUser } = user;
  return c.json({ user: safeUser, token });
});

app.post("/api/auth/logout", async (c) => c.json({ ok: true }));

app.get("/api/auth/me", async (c) => {
  const db = getDb(c);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, c.get("userId")));
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  const { password: _, ...safeUser } = user;
  return c.json(safeUser);
});

app.patch("/api/auth/change-password", async (c) => {
  const db = getDb(c);
  const userId = c.get("userId");
  const { currentPassword, newPassword } = await c.req.json();
  if (!currentPassword || !newPassword) return c.json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요" }, 400);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  if (!(await bcrypt.compare(currentPassword, user.password))) return c.json({ message: "현재 비밀번호가 일치하지 않습니다" }, 400);
  const hashed = await bcrypt.hash(newPassword, 10);
  await db.update(schema.users).set({ password: hashed }).where(eq(schema.users.id, userId));
  return c.json({ ok: true });
});

// --- Users ---
app.get("/api/users", async (c) => {
  const db = getDb(c);
  const users = await db.select().from(schema.users);
  return c.json(users.map(({ password: _, ...u }) => u));
});

app.post("/api/users", async (c) => {
  const current = await getCurrentUser(c);
  if (!current || current.role !== "SUPER_ADMIN") return c.json({ message: "권한이 없습니다" }, 403);
  const db = getDb(c);
  const { password, ...rest } = await c.req.json();
  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(schema.users).values({ ...rest, password: hashed }).returning();
  const { password: _, ...safeUser } = user;
  return c.json(safeUser);
});

app.patch("/api/users/:id", async (c) => {
  const current = await getCurrentUser(c);
  if (!current || current.role !== "SUPER_ADMIN") return c.json({ message: "권한이 없습니다" }, 403);
  const db = getDb(c);
  const [user] = await db.update(schema.users).set(await c.req.json()).where(eq(schema.users.id, c.req.param("id"))).returning();
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  const { password: _, ...safeUser } = user;
  return c.json(safeUser);
});

app.delete("/api/users/:id", async (c) => {
  const db = getDb(c);
  const [currentUser] = await db.select().from(schema.users).where(eq(schema.users.id, c.get("userId")));
  if (!currentUser || (currentUser.role !== "PM" && currentUser.role !== "SUPER_ADMIN")) {
    return c.json({ message: "권한이 없습니다" }, 403);
  }
  const result = await db.delete(schema.users).where(eq(schema.users.id, c.req.param("id"))).returning();
  if (!result.length) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  return c.json({ ok: true });
});

// --- Projects ---
app.get("/api/projects", async (c) => {
  const db = getDb(c);
  const user = await getCurrentUser(c);
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);

  // SUPER_ADMIN sees all projects
  if (user.role === "SUPER_ADMIN") {
    return c.json(await db.select().from(schema.projects));
  }
  // PM, MEMBER, CLIENT only see assigned projects
  const members = await db.select().from(schema.projectMembers).where(eq(schema.projectMembers.userId, user.id));
  if (!members.length) return c.json([]);
  const projectIds = members.map((m) => m.projectId);
  const allProjects = await db.select().from(schema.projects);
  return c.json(allProjects.filter((p) => projectIds.includes(p.id)));
});

app.post("/api/projects", async (c) => {
  // Only SUPER_ADMIN can create projects
  const user = await getCurrentUser(c);
  if (!user || user.role !== "SUPER_ADMIN") return c.json({ message: "권한이 없습니다" }, 403);
  const db = getDb(c);
  const [project] = await db.insert(schema.projects).values({ ...(await c.req.json()), createdBy: user.id }).returning();
  return c.json(project);
});

app.get("/api/projects/:id", async (c) => {
  const db = getDb(c);
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, c.req.param("id")));
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);
  return c.json(project);
});

app.patch("/api/projects/:id", async (c) => {
  const db = getDb(c);
  const [project] = await db.update(schema.projects).set(await c.req.json()).where(eq(schema.projects.id, c.req.param("id"))).returning();
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);
  return c.json(project);
});

app.delete("/api/projects/:id", async (c) => {
  const user = await getCurrentUser(c);
  if (!user || user.role !== "SUPER_ADMIN") return c.json({ message: "권한이 없습니다" }, 403);
  const db = getDb(c);
  const result = await db.delete(schema.projects).where(eq(schema.projects.id, c.req.param("id"))).returning();
  if (!result.length) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);
  return c.json({ ok: true });
});

// --- Project Phases ---
app.get("/api/projects/:id/phases", async (c) => {
  const db = getDb(c);
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, c.req.param("id")));
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);
  return c.json({ currentPhase: project.currentPhase });
});

app.patch("/api/projects/:id/phases", async (c) => {
  const db = getDb(c);
  const { currentPhase } = await c.req.json();
  const [project] = await db.update(schema.projects).set({ currentPhase }).where(eq(schema.projects.id, c.req.param("id"))).returning();
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);
  return c.json(project);
});

// --- Project Members ---
app.get("/api/projects/:id/members", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.projectMembers).where(eq(schema.projectMembers.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/members", async (c) => {
  const db = getDb(c);
  const [member] = await db.insert(schema.projectMembers).values({ ...(await c.req.json()), projectId: c.req.param("id") }).returning();
  return c.json(member);
});

app.delete("/api/projects/:id/members", async (c) => {
  const db = getDb(c);
  const { id } = await c.req.json();
  const result = await db.delete(schema.projectMembers).where(eq(schema.projectMembers.id, id)).returning();
  if (!result.length) return c.json({ message: "멤버를 찾을 수 없습니다" }, 404);
  return c.json({ ok: true });
});

// --- Schedules ---
app.get("/api/projects/:id/schedules", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.schedules).where(eq(schema.schedules.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/schedules", async (c) => {
  const db = getDb(c);
  const [schedule] = await db.insert(schema.schedules).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(schedule);
});

app.patch("/api/schedules/:id", async (c) => {
  const db = getDb(c);
  const [schedule] = await db.update(schema.schedules).set(await c.req.json()).where(eq(schema.schedules.id, c.req.param("id"))).returning();
  if (!schedule) return c.json({ message: "일정을 찾을 수 없습니다" }, 404);
  return c.json(schedule);
});

app.delete("/api/schedules/:id", async (c) => {
  const db = getDb(c);
  const [schedule] = await db.select().from(schema.schedules).where(eq(schema.schedules.id, c.req.param("id")));
  if (!schedule) return c.json({ message: "일정을 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, schedule.attachments);
  await db.delete(schema.schedules).where(eq(schema.schedules.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Daily Logs ---
app.get("/api/projects/:id/daily-logs", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.dailyLogs).where(eq(schema.dailyLogs.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/daily-logs", async (c) => {
  const db = getDb(c);
  const [log] = await db.insert(schema.dailyLogs).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(log);
});

app.patch("/api/daily-logs/:id", async (c) => {
  const db = getDb(c);
  const [log] = await db.update(schema.dailyLogs).set(await c.req.json()).where(eq(schema.dailyLogs.id, c.req.param("id"))).returning();
  if (!log) return c.json({ message: "작업일지를 찾을 수 없습니다" }, 404);
  return c.json(log);
});

app.delete("/api/daily-logs/:id", async (c) => {
  const db = getDb(c);
  const [dailyLog] = await db.select().from(schema.dailyLogs).where(eq(schema.dailyLogs.id, c.req.param("id")));
  if (!dailyLog) return c.json({ message: "작업일지를 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, dailyLog.attachments);
  await db.delete(schema.dailyLogs).where(eq(schema.dailyLogs.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Files ---
app.get("/api/projects/:id/files", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.files).where(eq(schema.files.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/files", async (c) => {
  const db = getDb(c);
  const [file] = await db.insert(schema.files).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(file);
});

app.patch("/api/files/:id", async (c) => {
  const db = getDb(c);
  const [file] = await db.update(schema.files).set(await c.req.json()).where(eq(schema.files.id, c.req.param("id"))).returning();
  if (!file) return c.json({ message: "파일을 찾을 수 없습니다" }, 404);
  return c.json(file);
});

app.delete("/api/files/:id", async (c) => {
  const db = getDb(c);
  const result = await db.delete(schema.files).where(eq(schema.files.id, c.req.param("id"))).returning();
  if (!result.length) return c.json({ message: "파일을 찾을 수 없습니다" }, 404);
  return c.json({ ok: true });
});

// --- Photos ---
app.get("/api/projects/:id/photos", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.photos).where(eq(schema.photos.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/photos", async (c) => {
  const db = getDb(c);
  const [photo] = await db.insert(schema.photos).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(photo);
});

app.patch("/api/photos/:id", async (c) => {
  const db = getDb(c);
  const [photo] = await db.update(schema.photos).set(await c.req.json()).where(eq(schema.photos.id, c.req.param("id"))).returning();
  if (!photo) return c.json({ message: "사진을 찾을 수 없습니다" }, 404);
  return c.json(photo);
});

// Delete orphan photo by URL (if no other entity references it)
app.post("/api/photos/cleanup-url", async (c) => {
  const db = getDb(c);
  const { url } = await c.req.json();
  if (!url) return c.json({ ok: true, deleted: false });
  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.imageUrl, url));
  if (!photo) return c.json({ ok: true, deleted: false });
  // Check if any other entity still references this URL
  const tables = [
    schema.schedules, schema.dailyLogs, schema.designChanges,
    schema.designChecks, schema.clientRequests, schema.inspections, schema.defects,
  ] as const;
  for (const tbl of tables) {
    const rows = await db.select().from(tbl);
    for (const row of rows) {
      const att = (row as any).attachments;
      if (!att) continue;
      try {
        const urls: string[] = JSON.parse(att);
        if (Array.isArray(urls) && urls.includes(url)) return c.json({ ok: true, deleted: false });
      } catch {}
    }
  }
  await cleanupPhotoR2(c.env.R2_BUCKET, photo.imageUrl);
  await db.delete(schema.photos).where(eq(schema.photos.id, photo.id));
  return c.json({ ok: true, deleted: true });
});

app.delete("/api/photos/:id", async (c) => {
  const db = getDb(c);
  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, c.req.param("id")));
  if (!photo) return c.json({ message: "사진을 찾을 수 없습니다" }, 404);
  await cleanupPhotoR2(c.env.R2_BUCKET, photo.imageUrl);
  await removeUrlFromAllAttachments(db, photo.imageUrl);
  await db.delete(schema.photos).where(eq(schema.photos.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Photo Upload (R2) ---
app.post("/api/projects/:id/photos/upload", async (c) => {
  const db = getDb(c);
  const userId = c.get("userId");
  const body = await c.req.parseBody({ all: true });
  const rawFiles = body["photos"];
  const fileList = Array.isArray(rawFiles) ? rawFiles : rawFiles ? [rawFiles] : [];
  const validFiles = fileList.filter((f): f is File => f instanceof File && f.size > 0);

  if (!validFiles.length) return c.json({ message: "파일이 없습니다" }, 400);
  if (validFiles.length > 10) return c.json({ message: "최대 10개까지 업로드 가능합니다" }, 400);

  const phase = (body["phase"] as string) || "CONSTRUCTION";
  const subCategory = (body["subCategory"] as string) || null;
  const publicUrl = c.env.R2_PUBLIC_URL || "";
  const results = [];

  for (const file of validFiles) {
    if (file.size > 20 * 1024 * 1024) continue; // skip > 20MB

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.random().toString(36).slice(2, 8);
    const ext = file.name.split(".").pop() || "bin";
    const fileName = `${date}_${rand}.${ext}`;

    await c.env.R2_BUCKET.put(fileName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    const workerUrl = new URL(c.req.url).origin;
    const fileUrl = publicUrl ? `${publicUrl}/${fileName}` : `${workerUrl}/api/photos/file/${fileName}`;
    const takenAt = new Date().toISOString().slice(0, 10);
    const isImage = file.type.startsWith("image/");

    const [photo] = await db.insert(schema.photos).values({
      projectId: c.req.param("id"),
      phase,
      imageUrl: fileUrl,
      thumbnailUrl: isImage ? fileUrl : null,
      description: file.name,
      tags: isImage ? null : "file",
      takenAt,
      subCategory,
      createdBy: userId,
    }).returning();
    results.push(photo);
  }
  return c.json(results);
});

// --- Photo File Serving (R2 proxy) ---
app.get("/api/photos/file/:key", async (c) => {
  const obj = await c.env.R2_BUCKET.get(c.req.param("key"));
  if (!obj) return c.json({ message: "파일을 찾을 수 없습니다" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
  headers.set("Cache-Control", "public, max-age=31536000");
  headers.set("Access-Control-Allow-Origin", "*");
  return new Response(obj.body, { headers });
});

// --- Photo ZIP Download ---
app.get("/api/projects/:id/photos/download-zip", async (c) => {
  const db = getDb(c);
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, c.req.param("id")));
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);

  const photoList = await db.select().from(schema.photos).where(eq(schema.photos.projectId, c.req.param("id")));
  if (!photoList.length) return c.json({ message: "사진이 없습니다" }, 404);

  const phaseLabels: Record<string, string> = {
    DESIGN: "01_설계", PERMIT: "02_인허가", CONSTRUCTION: "03_시공",
    COMPLETION: "04_준공", PORTFOLIO: "05_포트폴리오",
  };

  const zipFiles: Record<string, Uint8Array> = {};
  const counters: Record<string, number> = {};

  for (const photo of photoList) {
    const phaseFolder = phaseLabels[photo.phase] || photo.phase;
    const subFolder = photo.subCategory || "기타";
    const folderPath = `${phaseFolder}/${subFolder}`;
    counters[folderPath] = (counters[folderPath] || 0) + 1;

    const date = photo.takenAt || new Date().toISOString().slice(0, 10);
    const ext = photo.imageUrl.split(".").pop() || "jpg";
    const fileName = `${subFolder}_${date}_${counters[folderPath]}.${ext}`;

    try {
      let buffer: ArrayBuffer | null = null;
      if (photo.imageUrl.startsWith("/api/photos/file/")) {
        const r2Key = photo.imageUrl.split("/api/photos/file/")[1];
        const obj = await c.env.R2_BUCKET.get(r2Key);
        if (obj) buffer = await obj.arrayBuffer();
      } else if (photo.imageUrl.includes("/api/photos/file/")) {
        const r2Key = photo.imageUrl.split("/api/photos/file/")[1];
        const obj = await c.env.R2_BUCKET.get(r2Key);
        if (obj) buffer = await obj.arrayBuffer();
      } else {
        const res = await fetch(photo.imageUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) buffer = await res.arrayBuffer();
      }
      if (buffer) zipFiles[`${folderPath}/${fileName}`] = new Uint8Array(buffer);
    } catch { /* skip failed */ }
  }

  const zipped = zipSync(zipFiles);
  const filename = `${project.name}_photos.zip`;
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// --- Photo ZIP Download (per phase) ---
app.get("/api/projects/:id/photos/download-zip/:phase", async (c) => {
  const db = getDb(c);
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, c.req.param("id")));
  if (!project) return c.json({ message: "프로젝트를 찾을 수 없습니다" }, 404);

  const phase = c.req.param("phase");
  const allPhotos = await db.select().from(schema.photos).where(eq(schema.photos.projectId, c.req.param("id")));
  const photoList = allPhotos.filter((p) => p.phase === phase);
  if (!photoList.length) return c.json({ message: "해당 단계의 사진이 없습니다" }, 404);

  const phaseLabels: Record<string, string> = {
    DESIGN: "01_설계", PERMIT: "02_인허가", CONSTRUCTION: "03_시공",
    COMPLETION: "04_준공", PORTFOLIO: "05_포트폴리오",
  };

  const zipFiles: Record<string, Uint8Array> = {};
  const counters: Record<string, number> = {};

  for (const photo of photoList) {
    const subFolder = photo.subCategory || "기타";
    counters[subFolder] = (counters[subFolder] || 0) + 1;

    const date = photo.takenAt || new Date().toISOString().slice(0, 10);
    const ext = photo.imageUrl.split(".").pop() || "jpg";
    const fileName = `${subFolder}_${date}_${counters[subFolder]}.${ext}`;

    try {
      let buffer: ArrayBuffer | null = null;
      if (photo.imageUrl.startsWith("/api/photos/file/")) {
        const r2Key = photo.imageUrl.split("/api/photos/file/")[1];
        const obj = await c.env.R2_BUCKET.get(r2Key);
        if (obj) buffer = await obj.arrayBuffer();
      } else if (photo.imageUrl.includes("/api/photos/file/")) {
        const r2Key = photo.imageUrl.split("/api/photos/file/")[1];
        const obj = await c.env.R2_BUCKET.get(r2Key);
        if (obj) buffer = await obj.arrayBuffer();
      } else {
        const res = await fetch(photo.imageUrl, { signal: AbortSignal.timeout(10000) });
        if (res.ok) buffer = await res.arrayBuffer();
      }
      if (buffer) zipFiles[`${subFolder}/${fileName}`] = new Uint8Array(buffer);
    } catch { /* skip failed */ }
  }

  const zipped = zipSync(zipFiles);
  const phaseLabel = phaseLabels[phase] || phase;
  const filename = `${project.name}_${phaseLabel}_photos.zip`;
  return new Response(zipped, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Access-Control-Allow-Origin": "*",
    },
  });
});

// --- Client Requests ---
app.get("/api/projects/:id/requests", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.clientRequests).where(eq(schema.clientRequests.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/requests", async (c) => {
  const db = getDb(c);
  const [request] = await db.insert(schema.clientRequests).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(request);
});

app.patch("/api/requests/:id", async (c) => {
  const db = getDb(c);
  const [request] = await db.update(schema.clientRequests).set(await c.req.json()).where(eq(schema.clientRequests.id, c.req.param("id"))).returning();
  if (!request) return c.json({ message: "요청사항을 찾을 수 없습니다" }, 404);
  return c.json(request);
});

app.delete("/api/requests/:id", async (c) => {
  const db = getDb(c);
  const [request] = await db.select().from(schema.clientRequests).where(eq(schema.clientRequests.id, c.req.param("id")));
  if (!request) return c.json({ message: "요청사항을 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, request.attachments);
  await db.delete(schema.clientRequests).where(eq(schema.clientRequests.id, c.req.param("id")));
  // Also delete related comments
  await db.delete(schema.comments).where(eq(schema.comments.clientRequestId, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Comments ---
app.get("/api/requests/:id/comments", async (c) => {
  const db = getDb(c);
  const rows = await db.select().from(schema.comments).where(eq(schema.comments.clientRequestId, c.req.param("id")));
  const authorIds = Array.from(new Set(rows.map((r) => r.authorId)));
  const users = authorIds.length
    ? await Promise.all(authorIds.map(async (uid) => {
        const [u] = await db.select().from(schema.users).where(eq(schema.users.id, uid));
        return u;
      }))
    : [];
  const authorMap = new Map<string, { name: string; role: string }>();
  for (const u of users) if (u) authorMap.set(u.id, { name: u.name, role: u.role });
  const enriched = rows.map((r) => ({
    ...r,
    authorName: authorMap.get(r.authorId)?.name ?? null,
    authorRole: authorMap.get(r.authorId)?.role ?? null,
  }));
  return c.json(enriched);
});

app.post("/api/requests/:id/comments", async (c) => {
  const db = getDb(c);
  const [comment] = await db.insert(schema.comments).values({ ...(await c.req.json()), clientRequestId: c.req.param("id"), authorId: c.get("userId") }).returning();
  return c.json(comment);
});

app.patch("/api/comments/:id", async (c) => {
  const db = getDb(c);
  const user = await getCurrentUser(c);
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  const [existing] = await db.select().from(schema.comments).where(eq(schema.comments.id, c.req.param("id")));
  if (!existing) return c.json({ message: "댓글을 찾을 수 없습니다" }, 404);
  const canManage = user.role === "SUPER_ADMIN" || user.role === "PM";
  if (!canManage && existing.authorId !== user.id) {
    return c.json({ message: "댓글을 수정할 권한이 없습니다" }, 403);
  }
  const body = await c.req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return c.json({ message: "댓글 내용을 입력해주세요" }, 400);
  const [updated] = await db.update(schema.comments)
    .set({ content, updatedAt: new Date().toISOString() })
    .where(eq(schema.comments.id, c.req.param("id")))
    .returning();
  return c.json(updated);
});

app.delete("/api/comments/:id", async (c) => {
  const db = getDb(c);
  const user = await getCurrentUser(c);
  if (!user) return c.json({ message: "사용자를 찾을 수 없습니다" }, 404);
  const [existing] = await db.select().from(schema.comments).where(eq(schema.comments.id, c.req.param("id")));
  if (!existing) return c.json({ message: "댓글을 찾을 수 없습니다" }, 404);
  const canManage = user.role === "SUPER_ADMIN" || user.role === "PM";
  if (!canManage && existing.authorId !== user.id) {
    return c.json({ message: "댓글을 삭제할 권한이 없습니다" }, 403);
  }
  await db.delete(schema.comments).where(eq(schema.comments.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Design Changes ---
app.get("/api/projects/:id/design-changes", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.designChanges).where(eq(schema.designChanges.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/design-changes", async (c) => {
  const db = getDb(c);
  const [change] = await db.insert(schema.designChanges).values({ ...(await c.req.json()), projectId: c.req.param("id"), requestedBy: c.get("userId") }).returning();
  return c.json(change);
});

app.patch("/api/design-changes/:id", async (c) => {
  const db = getDb(c);
  const [change] = await db.update(schema.designChanges).set(await c.req.json()).where(eq(schema.designChanges.id, c.req.param("id"))).returning();
  if (!change) return c.json({ message: "설계변경을 찾을 수 없습니다" }, 404);
  return c.json(change);
});

app.delete("/api/design-changes/:id", async (c) => {
  const db = getDb(c);
  const [designChange] = await db.select().from(schema.designChanges).where(eq(schema.designChanges.id, c.req.param("id")));
  if (!designChange) return c.json({ message: "설계변경을 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, designChange.attachments);
  await db.delete(schema.designChanges).where(eq(schema.designChanges.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Design Checks ---
app.get("/api/projects/:id/design-checks", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.designChecks).where(eq(schema.designChecks.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/design-checks", async (c) => {
  const db = getDb(c);
  const [check] = await db.insert(schema.designChecks).values({ ...(await c.req.json()), projectId: c.req.param("id") }).returning();
  return c.json(check);
});

app.patch("/api/design-checks/:id", async (c) => {
  const db = getDb(c);
  const [check] = await db.update(schema.designChecks).set(await c.req.json()).where(eq(schema.designChecks.id, c.req.param("id"))).returning();
  if (!check) return c.json({ message: "체크리스트 항목을 찾을 수 없습니다" }, 404);
  return c.json(check);
});

app.delete("/api/design-checks/:id", async (c) => {
  const db = getDb(c);
  const [designCheck] = await db.select().from(schema.designChecks).where(eq(schema.designChecks.id, c.req.param("id")));
  if (!designCheck) return c.json({ message: "체크리스트 항목을 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, designCheck.attachments);
  await db.delete(schema.designChecks).where(eq(schema.designChecks.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Construction Tasks ---
app.get("/api/projects/:id/construction-tasks", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.constructionTasks).where(eq(schema.constructionTasks.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/construction-tasks", async (c) => {
  const db = getDb(c);
  const [task] = await db.insert(schema.constructionTasks).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(task);
});

app.post("/api/projects/:id/construction-tasks/bulk", async (c) => {
  const db = getDb(c);
  const userId = c.get("userId");
  const { tasks } = await c.req.json();
  if (!Array.isArray(tasks)) return c.json({ message: "tasks 배열이 필요합니다" }, 400);
  const results = [];
  for (const t of tasks) {
    const [task] = await db.insert(schema.constructionTasks).values({ ...t, projectId: c.req.param("id"), createdBy: userId }).returning();
    results.push(task);
  }
  return c.json(results);
});

app.patch("/api/projects/:id/construction-tasks/reorder", async (c) => {
  const db = getDb(c);
  const { orderedIds } = await c.req.json();
  if (!Array.isArray(orderedIds)) return c.json({ message: "orderedIds 배열이 필요합니다" }, 400);
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update(schema.constructionTasks).set({ sortOrder: i + 1 }).where(eq(schema.constructionTasks.id, orderedIds[i]));
  }
  return c.json({ ok: true });
});

app.patch("/api/construction-tasks/:id", async (c) => {
  const db = getDb(c);
  const [task] = await db.update(schema.constructionTasks).set(await c.req.json()).where(eq(schema.constructionTasks.id, c.req.param("id"))).returning();
  if (!task) return c.json({ message: "공정을 찾을 수 없습니다" }, 404);
  return c.json(task);
});

app.delete("/api/construction-tasks/:id", async (c) => {
  const db = getDb(c);
  const result = await db.delete(schema.constructionTasks).where(eq(schema.constructionTasks.id, c.req.param("id"))).returning();
  if (!result.length) return c.json({ message: "공정을 찾을 수 없습니다" }, 404);
  return c.json({ ok: true });
});

// --- Inspections ---
app.get("/api/projects/:id/inspections", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.inspections).where(eq(schema.inspections.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/inspections", async (c) => {
  const db = getDb(c);
  const [insp] = await db.insert(schema.inspections).values({ ...(await c.req.json()), projectId: c.req.param("id"), createdBy: c.get("userId") }).returning();
  return c.json(insp);
});

app.patch("/api/inspections/:id", async (c) => {
  const db = getDb(c);
  const [insp] = await db.update(schema.inspections).set(await c.req.json()).where(eq(schema.inspections.id, c.req.param("id"))).returning();
  if (!insp) return c.json({ message: "검수 항목을 찾을 수 없습니다" }, 404);
  return c.json(insp);
});

app.delete("/api/inspections/:id", async (c) => {
  const db = getDb(c);
  const [inspection] = await db.select().from(schema.inspections).where(eq(schema.inspections.id, c.req.param("id")));
  if (!inspection) return c.json({ message: "검수 항목을 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, inspection.attachments);
  await db.delete(schema.inspections).where(eq(schema.inspections.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Defects ---
app.get("/api/projects/:id/defects", async (c) => {
  const db = getDb(c);
  return c.json(await db.select().from(schema.defects).where(eq(schema.defects.projectId, c.req.param("id"))));
});

app.post("/api/projects/:id/defects", async (c) => {
  const db = getDb(c);
  const [defect] = await db.insert(schema.defects).values({ ...(await c.req.json()), projectId: c.req.param("id"), reportedBy: c.get("userId") }).returning();
  return c.json(defect);
});

app.patch("/api/defects/:id", async (c) => {
  const db = getDb(c);
  const [defect] = await db.update(schema.defects).set(await c.req.json()).where(eq(schema.defects.id, c.req.param("id"))).returning();
  if (!defect) return c.json({ message: "하자를 찾을 수 없습니다" }, 404);
  return c.json(defect);
});

app.delete("/api/defects/:id", async (c) => {
  const db = getDb(c);
  const [defect] = await db.select().from(schema.defects).where(eq(schema.defects.id, c.req.param("id")));
  if (!defect) return c.json({ message: "하자를 찾을 수 없습니다" }, 404);
  await cleanupAttachments(db, c.env.R2_BUCKET, defect.attachments);
  await db.delete(schema.defects).where(eq(schema.defects.id, c.req.param("id")));
  return c.json({ ok: true });
});

// --- Orphan Photo Cleanup ---
app.post("/api/projects/:id/cleanup-orphan-photos", async (c) => {
  const db = getDb(c);
  const pid = c.req.param("id");

  // Collect all attachment URLs from all entity tables
  const referencedUrls = new Set<string>();
  const tables = [
    { tbl: schema.schedules, col: "attachments", filter: eq(schema.schedules.projectId, pid) },
    { tbl: schema.dailyLogs, col: "attachments", filter: eq(schema.dailyLogs.projectId, pid) },
    { tbl: schema.designChanges, col: "attachments", filter: eq(schema.designChanges.projectId, pid) },
    { tbl: schema.designChecks, col: "attachments", filter: eq(schema.designChecks.projectId, pid) },
    { tbl: schema.clientRequests, col: "attachments", filter: eq(schema.clientRequests.projectId, pid) },
    { tbl: schema.inspections, col: "attachments", filter: eq(schema.inspections.projectId, pid) },
    { tbl: schema.defects, col: "attachments", filter: eq(schema.defects.projectId, pid) },
  ];
  for (const { tbl, filter } of tables) {
    const rows = await db.select().from(tbl).where(filter);
    for (const row of rows) {
      const att = (row as any).attachments;
      if (att) { try { const urls = JSON.parse(att); if (Array.isArray(urls)) urls.forEach((u: string) => referencedUrls.add(u)); } catch {} }
    }
  }

  // Get all photos for this project
  const allPhotos = await db.select().from(schema.photos).where(eq(schema.photos.projectId, pid));

  // Also keep photos that belong to design slots (평면도/입면도/공정사진 etc) — these are referenced by subCategory, not attachments
  const orphans = allPhotos.filter((p) => !referencedUrls.has(p.imageUrl) && !p.subCategory);

  let deleted = 0;
  for (const orphan of orphans) {
    await cleanupPhotoR2(c.env.R2_BUCKET, orphan.imageUrl);
    await db.delete(schema.photos).where(eq(schema.photos.id, orphan.id));
    deleted++;
  }

  return c.json({ ok: true, total: allPhotos.length, orphansDeleted: deleted, remaining: allPhotos.length - deleted });
});

export default app;
