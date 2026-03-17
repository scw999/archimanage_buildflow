DELETE FROM users;
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('admin-1', 'admin@buildflow.com', '$2b$10$AzxLP6PEZRcga4o5TrNxB.N6jeWSG8ew24FLAjX5Oi6U67eWFbB3i', '관리자', 'SUPER_ADMIN', datetime('now'));
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('manager-1', 'manager@buildflow.com', '$2b$10$OokFRQoh5Wahxng.Q4jN4e15iGHuYVl9QYPRsy7DG7mP/IU/XV9BO', '김매니저', 'PM', datetime('now'));
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('client-1', 'client@buildflow.com', '$2b$10$jaXb6xiIdF2Cy8Ua8lpAKup8UwI15M/gDMmaksxTbcsG3rpLsnR8W', '이건축주', 'CLIENT', datetime('now'));
