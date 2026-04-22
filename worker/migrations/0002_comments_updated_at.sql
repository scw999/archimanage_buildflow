-- D1 SQLite: ADD COLUMN은 IF NOT EXISTS를 지원하지 않음. 최초 1회만 적용.
ALTER TABLE comments ADD COLUMN updated_at TEXT;
