# 🗓️ Task Scheduler

A full-stack Task Scheduler: an **Express + SQLite** backend exposing a REST API, paired with a vanilla **HTML/CSS/JS** frontend that consumes it. Helps users plan, organize, and track daily tasks with priority-based ordering, search/filter, analytics, and persistent storage in a real database.

---

## 📌 Overview

Tasks are created, updated, completed, and deleted through a REST API backed by SQLite, with a dashboard-style frontend for managing them. The project intentionally applies classic **data structures and OS scheduling concepts** (Stack, Queue, Priority Scheduling, Earliest Deadline First) to real, everyday task-management behavior — not just as an abstract exercise, but wired directly into features like Undo Delete and the Completion History log.

---

## ✨ Features

- Add, edit, and delete tasks (persisted server-side)
- **Undo Delete** : restore the last deleted task (Stack, LIFO) via a `/restore` API call
- **Completion history** : a running log of completed tasks in the order they were finished (Queue, FIFO)
- **Priority Scheduling** : tasks ranked High → Medium → Low, visualized live in a "Ready Queue" panel
- Due-date sorting (earliest deadline first)
- Search by title, filter by status/priority
- Dashboard cards: Total, Pending, Completed, Overdue
- Progress bar showing % of tasks completed
- Chart.js analytics: tasks by priority (doughnut) and status split (bar)
- Dark mode toggle (remembered per-browser via Local Storage)
- Fully responsive, mobile-friendly layout
- Commented code throughout, front and back

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3 (custom properties for theming), JavaScript (ES6) |
| Backend | Node.js + Express.js — REST API |
| Database | SQLite, via the `better-sqlite3` npm package |
| Charts | Chart.js (via CDN) |
| Fonts | Space Grotesk, Inter, JetBrains Mono (Google Fonts) |

**Why SQLite instead of MySQL?** The whole project runs with `npm install && npm start` — no separate database server to install, configure, or keep running. SQLite is still a real relational database (full SQL, backed by a single `tasks.db` file). If your use case specifically calls for MySQL, `mysql-schema.sql` at the project root has the equivalent schema — the SQL used by the API is close enough to standard SQL that switching is a small change (see the **Switching to MySQL** note below).

---

## 📂 Project Structure

```
task-scheduler/
├── public/                    # Frontend — served as static files by Express
│   ├── index.html
│   ├── style.css
│   └── script.js               # talks to the backend via fetch()
├── server/                     # Backend
│   ├── server.js                 # Express app entry point
│   ├── db.js                      # SQLite connection, schema, seed data
│   ├── routes/
│   │   └── tasks.js                # REST API (CRUD + restore)
│   ├── package.json
│   ├── package-lock.json
│   └── tasks.db                     # created on first run (not committed)
├── mysql-schema.sql            # reference schema if you need real MySQL
└── README.md
```

---

## ⚙️ Setup & Installation

```bash
cd server
npm install
npm start
```

Then open **http://localhost:3000** in your browser. The frontend is served by the same Express app, so there's no CORS setup needed and no separate frontend server.

On first run, `server/tasks.db` is created automatically and seeded with a handful of sample tasks (see `db.js`) so the dashboard and charts aren't empty.

> Requires **Node.js 18+**. `better-sqlite3` ships prebuilt binaries, so `npm install` doesn't need any build tools installed.

---

## 🔌 REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task — body: `{ title, description, priority, dueDate }` |
| PUT | `/api/tasks/:id` | Update a task's fields |
| PATCH | `/api/tasks/:id/status` | Set status to `pending` or `completed` — stamps `completedAt` |
| DELETE | `/api/tasks/:id` | Delete a task, returns the deleted row |
| POST | `/api/tasks/restore` | Re-insert a previously deleted task (used by Undo) |

---

## 🧩 Data Structures & Algorithms Used

This project deliberately applies two classic data structures and an OS scheduling concept to real, working features:

### 1. Stack (LIFO) — Undo Delete
Implemented in `public/script.js` as a client-side `Stack` class. Every deleted task (returned by `DELETE /api/tasks/:id`) is **pushed** onto `deletedStack`. Clicking "Undo" **pops** the most recently deleted task and calls `POST /api/tasks/restore` to re-insert it — last deleted, first restored.

### 2. Queue (FIFO) — Completion History
Implemented as a `Queue` class. When a task is marked complete, its id is **enqueued** into `completedQueue`. The "Completion history" panel reads the queue front-to-back, so the task completed *first* is always listed *first*.

### 3. Priority Scheduling (OS concept)
The "Ready Queue" panel and default task ordering mirror how an OS priority scheduler picks the next process to run: **highest priority first**, ties broken by nearest due date.

### 4. Earliest Deadline First (Due-Date Sorting)
The "Sort: Due date" option orders tasks by nearest deadline — a direct application of EDF scheduling to task management.

---

## 🔄 Switching to MySQL

The shipped backend uses SQLite (`server/db.js`) so the project runs with zero external setup. To switch to MySQL instead:

1. Run `mysql-schema.sql` against a MySQL database (e.g. `task_scheduler`).
2. Replace `server/db.js` with a MySQL client (e.g. `mysql2`), keeping the same table/column names so `routes/tasks.js` needs no changes.
3. Add a `.env` file with your MySQL host/user/password/database and load it with `dotenv` in `server.js`.

---

## 📝 Notes

- `server/tasks.db` is created at runtime and holds your actual data — delete it to reset to the seed tasks.
- Dark mode preference is stored in the browser's Local Storage (the only thing that's still client-side-only, since it's a UI preference, not app data).
- Works on Node 18 and up.

---

## 📄 License

This project is open-source. Feel free to use, modify, and distribute it as per your needs.

---

## 🙌 Acknowledgements

- Built with [Express.js](https://expressjs.com/) and [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Charts powered by [Chart.js](https://www.chartjs.org/)
- Fonts via [Google Fonts](https://fonts.google.com/) (Space Grotesk, Inter, JetBrains Mono)
