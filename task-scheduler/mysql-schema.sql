-- =========================================================================
-- mysql-schema.sql
-- -------------------------------------------------------------------------
-- The shipped backend uses Node's built-in SQLite (see server/db.js) so the
-- project runs with zero external setup — no database server to install.
--
-- If your submission requires MySQL specifically, this is the equivalent
-- schema. The SQL used in server/routes/tasks.js is close enough to
-- standard SQL that switching mainly means:
--   1. Run this file against a MySQL database (e.g. `task_scheduler`).
--   2. Replace server/db.js with a MySQL client (e.g. `mysql2`), using the
--      same table/column names below so routes/tasks.js needs no changes.
--   3. Add a .env with your MySQL host/user/password/database and load it
--      with `dotenv` in server.js.
-- =========================================================================

CREATE DATABASE IF NOT EXISTS task_scheduler;
USE task_scheduler;

CREATE TABLE IF NOT EXISTS tasks (
  id            VARCHAR(36) PRIMARY KEY,
  title         VARCHAR(80) NOT NULL,
  description   VARCHAR(200) DEFAULT '',
  priority      ENUM('High','Medium','Low') NOT NULL,
  due_date      DATE NOT NULL,
  status        ENUM('pending','completed') NOT NULL DEFAULT 'pending',
  created_at    BIGINT NOT NULL,
  completed_at  BIGINT DEFAULT NULL
);

-- Optional sample rows (same as the SQLite seed data)
INSERT INTO tasks (id, title, description, priority, due_date, status, created_at, completed_at) VALUES
  (UUID(), 'Submit lab report', 'Electronics lab, Experiment 5', 'High', CURDATE() + INTERVAL 1 DAY, 'pending', UNIX_TIMESTAMP(NOW(3))*1000, NULL),
  (UUID(), 'Prepare CSI meetup slides', '', 'Medium', CURDATE() + INTERVAL 3 DAY, 'pending', UNIX_TIMESTAMP(NOW(3))*1000, NULL),
  (UUID(), 'Read IEEE paper on EKF', 'For drone flight review', 'Low', CURDATE() + INTERVAL 6 DAY, 'pending', UNIX_TIMESTAMP(NOW(3))*1000, NULL);
