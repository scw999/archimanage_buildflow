import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import bcrypt from "bcryptjs";

export async function autoMigrate() {
  if (!process.env.DATABASE_URL) {
    console.log("[auto-migrate] No DATABASE_URL, skipping (using in-memory storage)");
    return;
  }

  console.log("[auto-migrate] Starting DB migration...");
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    // Create all tables if they don't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        client_name TEXT,
        address TEXT,
        current_phase TEXT NOT NULL,
        status TEXT NOT NULL,
        cover_image_url TEXT,
        created_by VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS project_members (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        role TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS schedules (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        phase TEXT NOT NULL,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        memo TEXT,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS daily_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        phase TEXT NOT NULL,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        weather TEXT,
        workers INTEGER,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS files (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        phase TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT NOT NULL,
        version TEXT,
        description TEXT,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS photos (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        phase TEXT NOT NULL,
        image_url TEXT NOT NULL,
        thumbnail_url TEXT,
        description TEXT,
        tags TEXT,
        taken_at TEXT,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS client_requests (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        phase TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        category TEXT NOT NULL,
        assignee_id VARCHAR,
        created_by VARCHAR,
        created_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS comments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        client_request_id VARCHAR NOT NULL,
        author_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS design_changes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        reason TEXT,
        impact_area TEXT,
        status TEXT NOT NULL,
        requested_by VARCHAR,
        approved_by VARCHAR,
        related_file_id VARCHAR,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS design_checks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_by VARCHAR,
        completed_at TIMESTAMP,
        memo TEXT
      );
      CREATE TABLE IF NOT EXISTS construction_tasks (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        start_date TEXT,
        end_date TEXT,
        assignee TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS inspections (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        scheduled_date TEXT,
        completed_date TEXT,
        result TEXT NOT NULL,
        inspector TEXT,
        findings TEXT,
        created_by VARCHAR
      );
      CREATE TABLE IF NOT EXISTS defects (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        reported_by VARCHAR,
        assignee TEXT,
        reported_at TIMESTAMP DEFAULT NOW(),
        resolved_at TIMESTAMP
      );
    `);
    console.log("[auto-migrate] Tables created/verified");

    // Seed admin user if not exists
    const existing = await db.select().from(schema.users).where(
      sql`${schema.users.email} = 'admin@buildflow.com'`
    );

    if (existing.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await db.insert(schema.users).values({
        email: "admin@buildflow.com",
        password: hashedPassword,
        name: "관리자",
        role: "SUPER_ADMIN",
      });
      console.log("[auto-migrate] Admin user created: admin@buildflow.com / admin123");
    } else {
      console.log("[auto-migrate] Admin user already exists, skipping seed");
    }
  } catch (err) {
    console.error("[auto-migrate] Migration error:", err);
  } finally {
    await pool.end();
  }
}
