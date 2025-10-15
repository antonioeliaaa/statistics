CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL
);

-- =======================================
-- 2. INSERT DATA (8 rows)
-- =======================================
INSERT INTO events (device_id, timestamp, action) VALUES
('DEV-A', '2025-10-12T23:45:12Z', 'login_success'),
('DEV-B', '2025-10-13T08:46:01Z', 'login_failed'),
('DEV-A', '2025-10-13T08:50:45Z', 'password_reset'),
('DEV-C', '2025-10-13T09:01:33Z', 'login_success'),
('DEV-B', '2025-10-14T09:05:20Z', 'login_failed'),
('DEV-B', '2025-10-14T09:07:55Z', 'login_failed'),
('DEV-B', '2025-10-14T09:09:42Z', 'login_success'),
('DEV-C', '2025-10-14T09:15:00Z', 'login_success');
