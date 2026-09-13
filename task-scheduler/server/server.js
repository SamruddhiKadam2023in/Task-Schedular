/**
 * server.js
 * -----------------------------------------------------------------------
 * Entry point. Serves the frontend (../public) as static files and
 * exposes the REST API under /api/tasks. Run with `npm start` from the
 * server/ folder, then open http://localhost:3000
 * -----------------------------------------------------------------------
 */

const express = require('express');
const path = require('path');
const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/tasks', tasksRouter);

app.listen(PORT, () => {
  console.log(`Task Scheduler running at http://localhost:${PORT}`);
});
