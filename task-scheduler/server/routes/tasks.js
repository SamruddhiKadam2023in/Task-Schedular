/**
 * routes/tasks.js
 * -----------------------------------------------------------------------
 * REST API for tasks. All endpoints are prefixed with /api/tasks by
 * server.js. Each row from SQLite is mapped to the camelCase shape the
 * frontend already expects (dueDate, createdAt, completedAt).
 * -----------------------------------------------------------------------
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

// GET /api/tasks — list all tasks
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();
  res.json(rows.map(rowToTask));
});

// POST /api/tasks — create a task
router.post('/', (req, res) => {
  const { title, description = '', priority, dueDate } = req.body;
  if (!title || !priority || !dueDate) {
    return res.status(400).json({ error: 'title, priority and dueDate are required' });
  }
  const task = {
    id: crypto.randomUUID(),
    title,
    description,
    priority,
    dueDate,
    status: 'pending',
    createdAt: Date.now(),
    completedAt: null,
  };
  db.prepare(`
    INSERT INTO tasks (id, title, description, priority, due_date, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.title, task.description, task.priority, task.dueDate, task.status, task.createdAt, task.completedAt);
  res.status(201).json(task);
});

// PUT /api/tasks/:id — update title/description/priority/dueDate
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const title = req.body.title ?? existing.title;
  const description = req.body.description ?? existing.description;
  const priority = req.body.priority ?? existing.priority;
  const dueDate = req.body.dueDate ?? existing.due_date;

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, priority = ?, due_date = ? WHERE id = ?
  `).run(title, description, priority, dueDate, id);

  res.json(rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)));
});

// PATCH /api/tasks/:id/status — toggle pending/completed
// (Marking complete stamps completed_at — this is what drives the
// FIFO "completion history" queue on the frontend.)
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'status must be pending or completed' });
  }
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const completedAt = status === 'completed' ? Date.now() : null;
  db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?').run(status, completedAt, id);
  res.json(rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)));
});

// DELETE /api/tasks/:id — delete a task, returning the deleted row
// so the frontend can push it onto its undo Stack.
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json(rowToTask(existing));
});

// POST /api/tasks/restore — re-insert a previously deleted task with its
// original id, fields, and timestamps. Used by the frontend's Undo button
// (the client pops its Stack and sends the popped task back here).
router.post('/restore', (req, res) => {
  const t = req.body;
  if (!t.id || !t.title || !t.priority || !t.dueDate) {
    return res.status(400).json({ error: 'Invalid task payload for restore' });
  }
  db.prepare(`
    INSERT INTO tasks (id, title, description, priority, due_date, status, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.title, t.description || '', t.priority, t.dueDate, t.status || 'pending', t.createdAt || Date.now(), t.completedAt || null);
  res.status(201).json(rowToTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(t.id)));
});

module.exports = router;
