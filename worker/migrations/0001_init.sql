-- BuildFlow D1 Schema Migration
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  address TEXT,
  current_phase TEXT NOT NULL,
  status TEXT NOT NULL,
  cover_image_url TEXT,
  building_area TEXT,
  total_floor_area TEXT,
  building_coverage TEXT,
  floor_area_ratio TEXT,
  floors TEXT,
  basement_floors INTEGER,
  above_floors INTEGER,
  structure_type TEXT,
  main_use TEXT,
  special_notes TEXT,
  created_by TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS project_members (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  memo TEXT,
  location TEXT,
  time TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS daily_logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  weather TEXT,
  workers INTEGER,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  version TEXT,
  description TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT,
  tags TEXT,
  taken_at TEXT,
  sub_category TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS client_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  category TEXT NOT NULL,
  assignee_id TEXT,
  attachments TEXT,
  created_by TEXT,
  created_at TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  client_request_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS design_changes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  impact_area TEXT,
  status TEXT NOT NULL,
  requested_by TEXT,
  approved_by TEXT,
  related_file_id TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS design_checks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'DESIGN',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_by TEXT,
  completed_at TEXT,
  memo TEXT,
  linked_to_construction INTEGER NOT NULL DEFAULT 0,
  attachments TEXT
);

CREATE TABLE IF NOT EXISTS construction_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  assignee TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  memo TEXT,
  checklist TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  scheduled_date TEXT,
  completed_date TEXT,
  result TEXT NOT NULL,
  inspector TEXT,
  findings TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS defects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  reported_by TEXT,
  assignee TEXT,
  reported_at TEXT,
  resolved_at TEXT
);

-- Seed admin user (password: admin123, bcrypt hash)
INSERT OR IGNORE INTO users (id, email, password, name, role, created_at)
VALUES ('admin-1', 'admin@buildflow.com', '$2b$10$KEbDTotO8K0YSRn4zn9tAu4cvfk3tjDk6e7vGJXmAz8PzcsUlb04a', '김건축', 'PM', datetime('now'));

INSERT OR IGNORE INTO users (id, email, password, name, role, created_at)
VALUES ('client-1', 'client@buildflow.com', '$2b$10$XPx/y22JC.zHfndHvolsyO5ClBultpfaYjMl/QnA0Nox.rSfsR/JC', '이건축주', 'CLIENT', datetime('now'));
