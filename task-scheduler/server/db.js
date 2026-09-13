/**
 * db.js
 * -----------------------------------------------------------------------
 * Database layer for the Task Scheduler backend.
 *
 * Uses better-sqlite3 — a synchronous SQLite driver for Node.js that
 * ships prebuilt binaries (no C++ build tools needed on Windows/Mac/
 * Linux) and works on Node 18+. SQLite is a real relational database
 * engine backed by a single file (tasks.db) — it supports full SQL (the
 * same statements you'd write for MySQL), which is why swapping to MySQL
 * later is a small change (see mysql-schema.sql at the project root for
 * the equivalent MySQL schema and notes).
 * -----------------------------------------------------------------------
 */

const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'tasks.db');
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    priority TEXT NOT NULL CHECK (priority IN ('High','Medium','Low')),
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );
`);

// Seed with sample data on first run only, so the dashboard isn't empty.
const countRow = db.prepare('SELECT COUNT(*) AS n FROM tasks').get();
if (countRow.n === 0) {
  const today = new Date();
  const iso = (offsetDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  const insert = db.prepare(`
    INSERT INTO tasks (id, title, description, priority, due_date, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = [
    ['Fix GCS telemetry bug', '', 'High', iso(-1), 'pending', Date.now() - 2000, null],
    ['Submit lab report', 'Electronics lab, Experiment 5', 'High', iso(1), 'pending', Date.now() - 5000, null],
    ['Prepare CSI meetup slides', '', 'Medium', iso(3), 'pending', Date.now() - 4000, null],
    ['Read IEEE paper on EKF', 'For drone flight review', 'Low', iso(6), 'pending', Date.now() - 3000, null],
    ['Weekly report to guide', '', 'Medium', iso(-2), 'completed', Date.now() - 1000, Date.now() - 500],
  ];
  for (const [title, description, priority, dueDate, status, createdAt, completedAt] of seed) {
    insert.run(crypto.randomUUID(), title, description, priority, dueDate, status, createdAt, completedAt);
  }
}

module.exports = db;
