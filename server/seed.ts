import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await db.insert(schema.users).values({
    email: "admin@buildflow.com",
    password: hashedPassword,
    name: "관리자",
    role: "SUPER_ADMIN",
  }).onConflictDoNothing();

  console.log("Seed complete: admin@buildflow.com / admin123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
