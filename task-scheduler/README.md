# Task Scheduler

A full-stack Task Scheduler: an Express + SQLite backend exposing a REST API, and a vanilla HTML/CSS/JS frontend that consumes it. Helps users plan, organize, and track daily tasks — with priority-based ordering, search/filter, analytics, and persistent storage in a real database.

## Features

- Add, edit, and delete tasks (persisted server-side)
- **Undo Delete** — restore the last deleted task (Stack, LIFO) via a `/restore` API call
- **Completion history** — a running log of completed tasks in the order they were finished (Queue, FIFO)
- **Priority Scheduling** — tasks ranked High → Medium → Low, visualized live in a "Ready Queue" panel
- Due-date sorting (earliest deadline first)
- Search by title, filter by status/priority
- Dashboard cards: Total, Pending, Completed, Overdue
- Progress bar showing % of tasks completed
- Chart.js analytics: tasks by priority (doughnut) and status split (bar)
- Dark mode toggle (remembered per-browser)
- Fully responsive, mobile-friendly layout
- Commented code throughout, front and back

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (custom properties for theming), JavaScript (ES6) |
| Backend | Node.js + Express.js — REST API |
| Database | SQLite, via the `better-sqlite3` npm package |
| Charts | Chart.js (via CDN) |
| Fonts | Space Grotesk, Inter, JetBrains Mono (Google Fonts) |

**Why SQLite instead of MySQL:** the whole project runs with `npm install && npm start` — no separate database server to install, configure, or have running. SQLite is still a real relational database (full SQL, a single `tasks.db` file) — see `mysql-schema.sql` at the project root if your submission specifically requires MySQL; it's a small swap since the SQL and schema are nearly identical.

## Project Structure

```
task-scheduler/
├── public/                # Frontend — served as static files by Express
│   ├── index.html
│   ├── style.css
│   └── script.js            # talks to the backend via fetch()
├── server/                 # Backend
│   ├── server.js             # Express app entry point
│   ├── db.js                  # SQLite schema + seed data
│   ├── routes/tasks.js         # REST API (CRUD + restore)
│   ├── package.json
│   └── tasks.db                # created on first run (not committed)
├── mysql-schema.sql        # reference schema if you need real MySQL
└── README.md
```

## How to Run

```bash
cd server
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The frontend is served by the same Express app, so there's no CORS setup needed and no separate frontend server.

On first run, `server/tasks.db` is created automatically with a few sample tasks so the dashboard and charts aren't empty.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task — body: `{ title, description, priority, dueDate }` |
| PUT | `/api/tasks/:id` | Update a task's fields |
| PATCH | `/api/tasks/:id/status` | Set status to `pending` or `completed` — stamps `completedAt` |
| DELETE | `/api/tasks/:id` | Delete a task, returns the deleted row |
| POST | `/api/tasks/restore` | Re-insert a previously deleted task (used by Undo) |

## Data Structures & Algorithms Used

This project deliberately applies two classic data structures and an OS scheduling concept to real behaviour:

### 1. Stack (LIFO) — Undo Delete
Implemented in `public/script.js` as the `Stack` class, client-side. Every deleted task (returned by `DELETE /api/tasks/:id`) is **pushed** onto `deletedStack`. Clicking "Undo" **pops** the most recently deleted task and calls `POST /api/tasks/restore` to re-insert it — last deleted, first restored, classic LIFO.

### 2. Queue (FIFO) — Completion History
Implemented as the `Queue` class. When a task is marked complete, its id is **enqueued** into `completedQueue`. The "Completion history" panel reads the queue front-to-back, so the task completed *first* is always listed *first* — FIFO behaviour.

### 3. Priority Scheduling (Operating Systems concept)
The "Ready Queue" panel and the default task ordering apply the same logic an OS priority scheduler uses to pick the next process to run: **highest priority first**, ties broken by nearest due date.

### 4. Earliest Deadline First (Due-Date Sorting)
The "Sort: Due date" option orders tasks by nearest deadline — a direct application of Earliest Deadline First (EDF) scheduling to task management.

## Notes

- `server/tasks.db` is created at runtime and holds your actual data — delete it to reset to the seed tasks.
- Dark mode preference is stored in the browser's Local Storage (the only thing still client-side-only, since it's a UI preference, not app data).
- Works on Node 18 and up — `better-sqlite3` ships prebuilt binaries, so `npm install` doesn't need any build tools installed.
