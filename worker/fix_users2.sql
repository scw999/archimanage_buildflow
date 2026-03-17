DELETE FROM users;
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('admin-1', 'scw999', '$2b$10$i.7a4HvcHqm25QWbHFuy..I8rFU5hV9bNwqcSAJ75kIBS9t9dvtsq', '관리자', 'SUPER_ADMIN', datetime('now'));
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('manager-1', 'manager', '$2b$10$M4PI5oqq0qH5HNwZMWFGUeVAgJvzf0mm.xrtthBJoDMhen3ikkk7C', '김매니저', 'PM', datetime('now'));
INSERT INTO users (id, email, password, name, role, created_at) VALUES ('client-1', 'client', '$2b$10$4OojGBQB29oAKCn3/5jdUeUBuIT9I6LFlzvh16sRVcpsPXWKY5Dky', '이건축주', 'CLIENT', datetime('now'));
