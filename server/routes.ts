import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { uploadFile, getFileBuffer, isR2Enabled } from "./r2";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다") as any, false);
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "buildflow-dev-secret";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "인증이 필요합니다" });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Auth routes
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "이메일과 비밀번호를 입력해주세요" });
    }
    const user = await storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 일치하지 않습니다" });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 일치하지 않습니다" });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    const { password: _, ...safeUser } = user;
    return res.json({ user: safeUser, token });
  });

  app.post("/api/auth/logout", authMiddleware, async (_req: Request, res: Response) => {
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  // Users
  app.get("/api/users", authMiddleware, async (_req: Request, res: Response) => {
    const users = await storage.getUsers();
    const safeUsers = users.map(({ password: _, ...u }) => u);
    return res.json(safeUsers);
  });

  app.post("/api/users", authMiddleware, async (req: Request, res: Response) => {
    const { password, ...rest } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ ...rest, password: hashed });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  app.patch("/api/users/:id", authMiddleware, async (req: Request, res: Response) => {
    const user = await storage.updateUser(req.params.id, req.body);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    const { password: _, ...safeUser } = user;
    return res.json(safeUser);
  });

  // Projects
  app.get("/api/projects", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });

    let projectList;
    if (user.role === "CLIENT") {
      projectList = await storage.getProjectsByUserId(userId);
    } else {
      projectList = await storage.getProjects();
    }
    return res.json(projectList);
  });

  app.post("/api/projects", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const project = await storage.createProject({ ...req.body, createdBy: userId });
    return res.json(project);
  });

  app.get("/api/projects/:id", authMiddleware, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });
    return res.json(project);
  });

  app.patch("/api/projects/:id", authMiddleware, async (req: Request, res: Response) => {
    const project = await storage.updateProject(req.params.id, req.body);
    if (!project) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });
    return res.json(project);
  });

  app.delete("/api/projects/:id", authMiddleware, async (req: Request, res: Response) => {
    const success = await storage.deleteProject(req.params.id);
    if (!success) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });
    return res.json({ ok: true });
  });

  // Project phases
  app.get("/api/projects/:id/phases", authMiddleware, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });
    return res.json({ currentPhase: project.currentPhase });
  });

  app.patch("/api/projects/:id/phases", authMiddleware, async (req: Request, res: Response) => {
    const { currentPhase } = req.body;
    const project = await storage.updateProject(req.params.id, { currentPhase });
    if (!project) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });
    return res.json(project);
  });

  // Project Members
  app.get("/api/projects/:id/members", authMiddleware, async (req: Request, res: Response) => {
    const members = await storage.getProjectMembers(req.params.id);
    return res.json(members);
  });

  app.post("/api/projects/:id/members", authMiddleware, async (req: Request, res: Response) => {
    const member = await storage.addProjectMember({ ...req.body, projectId: req.params.id });
    return res.json(member);
  });

  // Schedules
  app.get("/api/projects/:id/schedules", authMiddleware, async (req: Request, res: Response) => {
    const schedules = await storage.getSchedulesByProject(req.params.id);
    return res.json(schedules);
  });

  app.post("/api/projects/:id/schedules", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const schedule = await storage.createSchedule({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(schedule);
  });

  // Daily Logs
  app.get("/api/projects/:id/daily-logs", authMiddleware, async (req: Request, res: Response) => {
    const logs = await storage.getDailyLogsByProject(req.params.id);
    return res.json(logs);
  });

  app.post("/api/projects/:id/daily-logs", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const log = await storage.createDailyLog({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(log);
  });

  // Files
  app.get("/api/projects/:id/files", authMiddleware, async (req: Request, res: Response) => {
    const files = await storage.getFilesByProject(req.params.id);
    return res.json(files);
  });

  app.post("/api/projects/:id/files", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const file = await storage.createFile({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(file);
  });

  // Photos
  app.get("/api/projects/:id/photos", authMiddleware, async (req: Request, res: Response) => {
    const photos = await storage.getPhotosByProject(req.params.id);
    return res.json(photos);
  });

  app.post("/api/projects/:id/photos", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const photo = await storage.createPhoto({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(photo);
  });

  app.patch("/api/photos/:id", authMiddleware, async (req: Request, res: Response) => {
    const photo = await storage.updatePhoto(req.params.id, req.body);
    if (!photo) return res.status(404).json({ message: "사진을 찾을 수 없습니다" });
    return res.json(photo);
  });

  app.delete("/api/photos/:id", authMiddleware, async (req: Request, res: Response) => {
    const success = await storage.deletePhoto(req.params.id);
    if (!success) return res.status(404).json({ message: "사진을 찾을 수 없습니다" });
    return res.json({ ok: true });
  });

  // Photo file upload (R2 or local)
  app.post("/api/projects/:id/photos/upload", authMiddleware, upload.array("photos", 20), async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: "파일이 없습니다" });

    const { phase, subCategory } = req.body;
    const results = [];
    for (const file of files) {
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).slice(2, 8);
      const ext = path.extname(file.originalname) || ".jpg";
      const fileName = `${date}_${rand}${ext}`;

      const imageUrl = await uploadFile(fileName, file.buffer, file.mimetype);
      const takenAt = new Date().toISOString().slice(0, 10);
      const photo = await storage.createPhoto({
        projectId: req.params.id,
        phase: phase || "CONSTRUCTION",
        imageUrl,
        thumbnailUrl: imageUrl,
        description: file.originalname,
        tags: null,
        takenAt,
        subCategory: subCategory || null,
        createdBy: userId,
      });
      results.push(photo);
    }
    return res.json(results);
  });

  // Serve R2 files via proxy (when no public URL configured)
  app.get("/api/photos/file/:key", async (req: Request, res: Response) => {
    const buffer = await getFileBuffer(req.params.key);
    if (!buffer) return res.status(404).json({ message: "파일을 찾을 수 없습니다" });
    const ext = path.extname(req.params.key).toLowerCase();
    const mimeMap: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp" };
    res.setHeader("Content-Type", mimeMap[ext] || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return res.send(buffer);
  });

  // Photo ZIP download
  app.get("/api/projects/:id/photos/download-zip", authMiddleware, async (req: Request, res: Response) => {
    const project = await storage.getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "프로젝트를 찾을 수 없습니다" });

    const photos = await storage.getPhotosByProject(req.params.id);
    if (!photos.length) return res.status(404).json({ message: "사진이 없습니다" });

    const phaseLabels: Record<string, string> = {
      DESIGN: "01_설계", PERMIT: "02_인허가", CONSTRUCTION: "03_시공",
      COMPLETION: "04_준공", PORTFOLIO: "05_포트폴리오",
    };

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(project.name)}_photos.zip"`);

    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.pipe(res);

    // Group photos and add to archive
    const counters: Record<string, number> = {};
    for (const photo of photos) {
      const phaseFolder = phaseLabels[photo.phase] || photo.phase;
      const subFolder = (photo as any).subCategory || "기타";
      const folderPath = `${phaseFolder}/${subFolder}`;
      const key = folderPath;
      counters[key] = (counters[key] || 0) + 1;

      const date = photo.takenAt || new Date().toISOString().slice(0, 10);
      const ext = path.extname(photo.imageUrl) || ".jpg";
      const fileName = `${subFolder}_${date}_${counters[key]}${ext}`;

      // Get file content
      if (photo.imageUrl.startsWith("/uploads/")) {
        const filePath = path.join(process.cwd(), photo.imageUrl);
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `${folderPath}/${fileName}` });
        }
      } else if (photo.imageUrl.startsWith("/api/photos/file/")) {
        // R2 stored file
        const r2Key = photo.imageUrl.replace("/api/photos/file/", "");
        const buffer = await getFileBuffer(r2Key);
        if (buffer) archive.append(buffer, { name: `${folderPath}/${fileName}` });
      } else {
        // External URL - fetch and add
        try {
          const response = await fetch(photo.imageUrl);
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            archive.append(buffer, { name: `${folderPath}/${fileName}` });
          }
        } catch {
          // Skip failed downloads
        }
      }
    }

    await archive.finalize();
  });

  // Client Requests
  app.get("/api/projects/:id/requests", authMiddleware, async (req: Request, res: Response) => {
    const requests = await storage.getRequestsByProject(req.params.id);
    return res.json(requests);
  });

  app.post("/api/projects/:id/requests", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const request = await storage.createRequest({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(request);
  });

  app.patch("/api/requests/:id", authMiddleware, async (req: Request, res: Response) => {
    const request = await storage.updateRequest(req.params.id, req.body);
    if (!request) return res.status(404).json({ message: "요청사항을 찾을 수 없습니다" });
    return res.json(request);
  });

  // Comments
  app.get("/api/requests/:id/comments", authMiddleware, async (req: Request, res: Response) => {
    const comments = await storage.getCommentsByRequest(req.params.id);
    return res.json(comments);
  });

  app.post("/api/requests/:id/comments", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const comment = await storage.createComment({ ...req.body, clientRequestId: req.params.id, authorId: userId });
    return res.json(comment);
  });

  // Password change
  app.patch("/api/auth/change-password", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "현재 비밀번호와 새 비밀번호를 입력해주세요" });
    }
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(400).json({ message: "현재 비밀번호가 일치하지 않습니다" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await storage.updateUser(userId, { password: hashed });
    return res.json({ ok: true });
  });

  // User deletion (PM/SUPER_ADMIN only)
  app.delete("/api/users/:id", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const currentUser = await storage.getUser(userId);
    if (!currentUser || (currentUser.role !== "PM" && currentUser.role !== "SUPER_ADMIN")) {
      return res.status(403).json({ message: "권한이 없습니다" });
    }
    const success = await storage.deleteUser(req.params.id);
    if (!success) return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    return res.json({ ok: true });
  });

  // Design Changes
  app.get("/api/projects/:id/design-changes", authMiddleware, async (req: Request, res: Response) => {
    const changes = await storage.getDesignChangesByProject(req.params.id);
    return res.json(changes);
  });

  app.post("/api/projects/:id/design-changes", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const change = await storage.createDesignChange({ ...req.body, projectId: req.params.id, requestedBy: userId });
    return res.json(change);
  });

  app.patch("/api/design-changes/:id", authMiddleware, async (req: Request, res: Response) => {
    const change = await storage.updateDesignChange(req.params.id, req.body);
    if (!change) return res.status(404).json({ message: "설계변경을 찾을 수 없습니다" });
    return res.json(change);
  });

  // Design Checks
  app.get("/api/projects/:id/design-checks", authMiddleware, async (req: Request, res: Response) => {
    const checks = await storage.getDesignChecksByProject(req.params.id);
    return res.json(checks);
  });

  app.post("/api/projects/:id/design-checks", authMiddleware, async (req: Request, res: Response) => {
    const check = await storage.createDesignCheck({ ...req.body, projectId: req.params.id });
    return res.json(check);
  });

  app.patch("/api/design-checks/:id", authMiddleware, async (req: Request, res: Response) => {
    const check = await storage.updateDesignCheck(req.params.id, req.body);
    if (!check) return res.status(404).json({ message: "체크리스트 항목을 찾을 수 없습니다" });
    return res.json(check);
  });

  // Construction Tasks
  app.get("/api/projects/:id/construction-tasks", authMiddleware, async (req: Request, res: Response) => {
    const tasks = await storage.getConstructionTasksByProject(req.params.id);
    return res.json(tasks);
  });

  app.post("/api/projects/:id/construction-tasks", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const task = await storage.createConstructionTask({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(task);
  });

  // Bulk create construction tasks
  app.post("/api/projects/:id/construction-tasks/bulk", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ message: "tasks 배열이 필요합니다" });
    const results = [];
    for (const t of tasks) {
      const task = await storage.createConstructionTask({ ...t, projectId: req.params.id, createdBy: userId });
      results.push(task);
    }
    return res.json(results);
  });

  // Reorder construction tasks
  app.patch("/api/projects/:id/construction-tasks/reorder", authMiddleware, async (req: Request, res: Response) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "orderedIds 배열이 필요합니다" });
    for (let i = 0; i < orderedIds.length; i++) {
      await storage.updateConstructionTask(orderedIds[i], { sortOrder: i + 1 });
    }
    return res.json({ ok: true });
  });

  app.patch("/api/construction-tasks/:id", authMiddleware, async (req: Request, res: Response) => {
    const task = await storage.updateConstructionTask(req.params.id, req.body);
    if (!task) return res.status(404).json({ message: "공정을 찾을 수 없습니다" });
    return res.json(task);
  });

  app.delete("/api/construction-tasks/:id", authMiddleware, async (req: Request, res: Response) => {
    const success = await storage.deleteConstructionTask(req.params.id);
    if (!success) return res.status(404).json({ message: "공정을 찾을 수 없습니다" });
    return res.json({ ok: true });
  });

  // Inspections
  app.get("/api/projects/:id/inspections", authMiddleware, async (req: Request, res: Response) => {
    const inspections = await storage.getInspectionsByProject(req.params.id);
    return res.json(inspections);
  });

  app.post("/api/projects/:id/inspections", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const inspection = await storage.createInspection({ ...req.body, projectId: req.params.id, createdBy: userId });
    return res.json(inspection);
  });

  app.patch("/api/inspections/:id", authMiddleware, async (req: Request, res: Response) => {
    const inspection = await storage.updateInspection(req.params.id, req.body);
    if (!inspection) return res.status(404).json({ message: "검수 항목을 찾을 수 없습니다" });
    return res.json(inspection);
  });

  // Defects
  app.get("/api/projects/:id/defects", authMiddleware, async (req: Request, res: Response) => {
    const defects = await storage.getDefectsByProject(req.params.id);
    return res.json(defects);
  });

  app.post("/api/projects/:id/defects", authMiddleware, async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    const defect = await storage.createDefect({ ...req.body, projectId: req.params.id, reportedBy: userId });
    return res.json(defect);
  });

  app.patch("/api/defects/:id", authMiddleware, async (req: Request, res: Response) => {
    const defect = await storage.updateDefect(req.params.id, req.body);
    if (!defect) return res.status(404).json({ message: "하자를 찾을 수 없습니다" });
    return res.json(defect);
  });

  return httpServer;
}
