/* =========================================================================
   TASK SCHEDULER — script.js
   -------------------------------------------------------------------------
   DATA STRUCTURES & ALGORITHMS USED (called out explicitly per spec):

   1. STACK  (class Stack, LIFO)
      Backs "Undo Delete". Every deleted task is PUSHed onto deletedStack.
      Undo POPs the most recently deleted task back into the task list —
      classic LIFO behaviour (last deleted, first restored).

   2. QUEUE  (class Queue, FIFO)
      Backs "Completion history". When a task is marked complete it is
      ENQUEUEd. The history panel DEQUEUEs from the front, so the task
      completed earliest is always listed first — first-in, first-out.

   3. PRIORITY SCHEDULING (OS concept)
      The "Ready Queue" panel and the default sort order both rank tasks
      High > Medium > Low, exactly mirroring how a priority-scheduling
      CPU scheduler picks the next process to run: highest priority first,
      ties broken by arrival/due time. This is a direct application of
      the OS Priority Scheduling algorithm to task ordering.

   4. DUE-DATE SORTING (analogous to Shortest-Job/Earliest-Deadline-First)
      Sorting by nearest due date mirrors Earliest Deadline First (EDF)
      scheduling — the task with the closest deadline runs first.
   ========================================================================= */

// ---------------------------------------------------------------------
// DSA: STACK — simple array-backed LIFO stack for undo-delete
// ---------------------------------------------------------------------
class Stack {
  constructor() { this.items = []; }
  push(item) { this.items.push(item); }
  pop() { return this.items.pop(); }
  peek() { return this.items[this.items.length - 1]; }
  isEmpty() { return this.items.length === 0; }
}

// ---------------------------------------------------------------------
// DSA: QUEUE — simple array-backed FIFO queue for completion history
// ---------------------------------------------------------------------
class Queue {
  constructor() { this.items = []; }
  enqueue(item) { this.items.push(item); }
  dequeue() { return this.items.shift(); }
  toArray() { return [...this.items]; } // front -> back
  isEmpty() { return this.items.length === 0; }
}

// ---------------------------------------------------------------------
// STATE
// ---------------------------------------------------------------------
const THEME_KEY = 'taskScheduler.theme.v1';
const API_BASE = '/api/tasks';

let tasks = [];                 // all tasks, single source of truth (mirrors the server)
const deletedStack = new Stack();   // for undo — holds full task rows client-side
const completedQueue = new Queue(); // completion history (rebuilt from server data on load)

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

let editingTaskId = null;
let undoTimer = null;

// ---------------------------------------------------------------------
// API CLIENT — thin wrapper around fetch() for the Express/SQLite backend
// ---------------------------------------------------------------------
async function apiRequest(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

const api = {
  list: () => apiRequest(''),
  create: (task) => apiRequest('', { method: 'POST', body: JSON.stringify(task) }),
  update: (id, task) => apiRequest(`/${id}`, { method: 'PUT', body: JSON.stringify(task) }),
  setStatus: (id, status) => apiRequest(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id) => apiRequest(`/${id}`, { method: 'DELETE' }),
  restore: (task) => apiRequest('/restore', { method: 'POST', body: JSON.stringify(task) }),
};

// ---------------------------------------------------------------------
// PERSISTENCE — backed by the Express + SQLite API (see server/)
// ---------------------------------------------------------------------
async function loadTasks() {
  tasks = await api.list();
  // Rebuild completion queue (FIFO by completedAt) from server data
  completedQueue.items = [];
  tasks
    .filter(t => t.status === 'completed')
    .sort((a, b) => (a.completedAt || 0) - (b.completedAt || 0))
    .forEach(t => completedQueue.enqueue(t.id));
}

// ---------------------------------------------------------------------
// THEME (dark mode)
// ---------------------------------------------------------------------
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('iconSun').style.display = theme === 'dark' ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = theme === 'dark' ? 'none' : 'block';
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

// ---------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------
function isOverdue(task) {
  if (task.status === 'completed') return false;
  const today = new Date().toISOString().slice(0, 10);
  return task.dueDate < today;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getTaskById(id) { return tasks.find(t => t.id === id); }

// ---------------------------------------------------------------------
// PRIORITY SCHEDULING — sort comparator (OS-style priority scheduler)
// ---------------------------------------------------------------------
function sortTasks(list, mode) {
  const arr = [...list];
  if (mode === 'priority') {
    // Highest priority first (ties broken by nearest due date) —
    // mirrors an OS priority scheduler picking the next process to run.
    arr.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.dueDate.localeCompare(b.dueDate));
  } else if (mode === 'dueDate') {
    // Earliest-deadline-first ordering
    arr.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  } else if (mode === 'created') {
    arr.sort((a, b) => b.createdAt - a.createdAt);
  }
  return arr;
}

// ---------------------------------------------------------------------
// RENDER: READY QUEUE (signature element)
// ---------------------------------------------------------------------
function renderReadyQueue() {
  const track = document.getElementById('readyQueue');
  const pending = sortTasks(tasks.filter(t => t.status === 'pending'), 'priority').slice(0, 8);

  if (pending.length === 0) {
    track.innerHTML = '<div class="queue-empty">Queue is empty — every task is completed.</div>';
    return;
  }

  track.innerHTML = pending.map((t, i) => `
    <div class="queue-chip">
      <div class="chip-title-row">
        <span class="chip-pos">${i + 1}</span>
        <span class="chip-title">${escapeHtml(t.title)}</span>
      </div>
      <span class="chip-meta">
        <span class="pri-dot ${t.priority}"></span>${t.priority}
        <span>&middot;</span>
        <span>${formatDate(t.dueDate)}</span>
      </span>
    </div>
  `).join('');
}

// ---------------------------------------------------------------------
// RENDER: DASHBOARD STATS + PROGRESS
// ---------------------------------------------------------------------
function renderStats() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const overdue = tasks.filter(isOverdue).length;
  const pending = total - completed;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statOverdue').textContent = overdue;

  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
}

// ---------------------------------------------------------------------
// RENDER: TASK LIST (applies search + filter + sort)
// ---------------------------------------------------------------------
function getVisibleTasks() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const statusFilter = document.getElementById('filterStatus').value;
  const priorityFilter = document.getElementById('filterPriority').value;
  const sortMode = document.getElementById('sortBy').value;

  let list = tasks.filter(t => {
    const matchesQuery = t.title.toLowerCase().includes(query);
    const overdue = isOverdue(t);
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'overdue' ? overdue :
      t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' ? true : t.priority === priorityFilter;
    return matchesQuery && matchesStatus && matchesPriority;
  });

  return sortTasks(list, sortMode);
}

function renderTaskList() {
  const listEl = document.getElementById('taskList');
  const emptyEl = document.getElementById('emptyState');
  const visible = getVisibleTasks();

  if (visible.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  listEl.innerHTML = visible.map(t => {
    const overdue = isOverdue(t);
    const done = t.status === 'completed';
    return `
      <div class="task-card ${done ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-id="${t.id}">
        <button class="task-check ${done ? 'checked' : ''}" data-action="toggle" title="Mark ${done ? 'pending' : 'complete'}">
          ${done ? '&#10003;' : ''}
        </button>
        <div class="task-body">
          <div class="task-title-row">
            <span class="task-title ${done ? 'strike' : ''}">${escapeHtml(t.title)}</span>
            <span class="badge ${t.priority}">${t.priority}</span>
            ${overdue ? '<span class="badge overdue-badge">Overdue</span>' : ''}
          </div>
          ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
          <div class="task-meta">due ${formatDate(t.dueDate)}</div>
        </div>
        <div class="task-actions">
          <button class="icon-btn" data-action="edit" title="Edit">&#9998;</button>
          <button class="icon-btn danger" data-action="delete" title="Delete">&#128465;</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------------------------------------------------------------
// RENDER: COMPLETION HISTORY (Queue, FIFO)
// ---------------------------------------------------------------------
function renderCompletedQueue() {
  const ul = document.getElementById('completedQueueList');
  const ids = completedQueue.toArray().filter(id => getTaskById(id) && getTaskById(id).status === 'completed');

  if (ids.length === 0) {
    ul.innerHTML = '<li class="completed-empty">No tasks completed yet.</li>';
    return;
  }

  ul.innerHTML = ids.map(id => {
    const t = getTaskById(id);
    const time = t.completedAt ? new Date(t.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
    return `<li><span>${escapeHtml(t.title)}</span><span class="done-time">${time}</span></li>`;
  }).join('');
}

// ---------------------------------------------------------------------
// CHARTS (Chart.js)
// ---------------------------------------------------------------------
let priorityChartInstance = null;
let statusChartInstance = null;

function renderCharts() {
  const styles = getComputedStyle(document.documentElement);
  const colorHigh = styles.getPropertyValue('--high').trim();
  const colorMedium = styles.getPropertyValue('--medium').trim();
  const colorLow = styles.getPropertyValue('--low').trim();
  const colorAccent = styles.getPropertyValue('--accent').trim();
  const colorMuted = styles.getPropertyValue('--text-muted').trim();
  const colorText = styles.getPropertyValue('--text').trim();

  const byPriority = { High: 0, Medium: 0, Low: 0 };
  tasks.forEach(t => byPriority[t.priority]++);

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.length - completedCount;

  const priorityCtx = document.getElementById('priorityChart');
  const statusCtx = document.getElementById('statusChart');

  if (priorityChartInstance) priorityChartInstance.destroy();
  if (statusChartInstance) statusChartInstance.destroy();

  priorityChartInstance = new Chart(priorityCtx, {
    type: 'doughnut',
    data: {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        data: [byPriority.High, byPriority.Medium, byPriority.Low],
        backgroundColor: [colorHigh, colorMedium, colorLow],
        borderWidth: 0,
      }]
    },
    options: {
      plugins: { legend: { position: 'bottom', labels: { color: colorText, boxWidth: 10, font: { size: 11 } } } },
      cutout: '65%'
    }
  });

  statusChartInstance = new Chart(statusCtx, {
    type: 'bar',
    data: {
      labels: ['Pending', 'Completed'],
      datasets: [{
        data: [pendingCount, completedCount],
        backgroundColor: [colorAccent, colorLow],
        borderRadius: 6,
        maxBarThickness: 40,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: colorMuted, stepSize: 1 }, grid: { color: 'rgba(128,128,128,0.15)' } },
        x: { ticks: { color: colorMuted }, grid: { display: false } }
      }
    }
  });
}

// ---------------------------------------------------------------------
// MASTER RENDER
// ---------------------------------------------------------------------
function renderAll() {
  renderReadyQueue();
  renderStats();
  renderTaskList();
  renderCompletedQueue();
  try {
    renderCharts();
  } catch (err) {
    console.warn('Chart.js unavailable — analytics charts skipped.', err);
  }
}

// ---------------------------------------------------------------------
// CRUD — Add / Edit
// ---------------------------------------------------------------------
const modal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');

function openModal(task = null) {
  editingTaskId = task ? task.id : null;
  document.getElementById('modalTitle').textContent = task ? 'Edit Task' : 'Add Task';
  document.getElementById('taskId').value = task ? task.id : '';
  document.getElementById('taskTitle').value = task ? task.title : '';
  document.getElementById('taskDesc').value = task ? task.description : '';
  document.getElementById('taskPriority').value = task ? task.priority : 'Medium';
  document.getElementById('taskDueDate').value = task ? task.dueDate : new Date().toISOString().slice(0, 10);
  modal.style.display = 'flex';
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  modal.style.display = 'none';
  taskForm.reset();
  editingTaskId = null;
}

document.getElementById('addTaskBtn').addEventListener('click', () => openModal());
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDesc').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const dueDate = document.getElementById('taskDueDate').value;
  if (!title || !dueDate) return;

  try {
    if (editingTaskId) {
      const updated = await api.update(editingTaskId, { title, description, priority, dueDate });
      const t = getTaskById(editingTaskId);
      Object.assign(t, updated);
    } else {
      const created = await api.create({ title, description, priority, dueDate });
      tasks.push(created);
    }
    closeModal();
    renderAll();
  } catch (err) {
    alert('Could not save task: ' + err.message);
  }
});

// ---------------------------------------------------------------------
// CRUD — Toggle complete / Delete (+ Undo via Stack) / Edit trigger
// ---------------------------------------------------------------------
document.getElementById('taskList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const card = e.target.closest('.task-card');
  const id = card.dataset.id;
  const task = getTaskById(id);
  if (!task) return;

  const action = btn.dataset.action;

  if (action === 'toggle') {
    const nextStatus = task.status === 'pending' ? 'completed' : 'pending';
    try {
      const updated = await api.setStatus(id, nextStatus);
      Object.assign(task, updated);
      if (nextStatus === 'completed') {
        completedQueue.enqueue(task.id); // DSA: enqueue on completion (FIFO history)
      } else {
        // Rebuild queue without this id (keeps FIFO order of the rest)
        completedQueue.items = completedQueue.toArray().filter(qid => qid !== task.id);
      }
      renderAll();
    } catch (err) {
      alert('Could not update task: ' + err.message);
    }
  }

  if (action === 'edit') {
    openModal(task);
  }

  if (action === 'delete') {
    deleteTask(id);
  }
});

async function deleteTask(id) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;
  try {
    const removed = await api.remove(id); // server deletes + returns the row
    tasks.splice(index, 1);
    deletedStack.push(removed); // DSA: push onto undo stack (LIFO)

    // Also drop it from the completion queue if present
    completedQueue.items = completedQueue.items.filter(qid => qid !== id);

    renderAll();
    showUndoToast(removed.title);
  } catch (err) {
    alert('Could not delete task: ' + err.message);
  }
}

// ---------------------------------------------------------------------
// UNDO TOAST — pops the Stack
// ---------------------------------------------------------------------
const undoToast = document.getElementById('undoToast');
const undoMessage = document.getElementById('undoMessage');

function showUndoToast(title) {
  clearTimeout(undoTimer);
  undoMessage.textContent = `"${title}" deleted`;
  undoToast.style.display = 'flex';
  undoTimer = setTimeout(() => { undoToast.style.display = 'none'; }, 5000);
}

document.getElementById('undoBtn').addEventListener('click', async () => {
  if (deletedStack.isEmpty()) return;
  const popped = deletedStack.pop(); // DSA: pop most recently deleted (LIFO)
  try {
    const restored = await api.restore(popped);
    tasks.push(restored);
    if (restored.status === 'completed') {
      completedQueue.enqueue(restored.id);
    }
    undoToast.style.display = 'none';
    clearTimeout(undoTimer);
    renderAll();
  } catch (err) {
    alert('Could not restore task: ' + err.message);
    deletedStack.push(popped); // put it back so the user can retry
  }
});

// ---------------------------------------------------------------------
// CONTROLS — search / filter / sort just trigger a re-render of the list
// ---------------------------------------------------------------------
['searchInput'].forEach(id => document.getElementById(id).addEventListener('input', renderTaskList));
['filterStatus', 'filterPriority', 'sortBy'].forEach(id => document.getElementById(id).addEventListener('change', renderTaskList));

// ---------------------------------------------------------------------
// UTIL
// ---------------------------------------------------------------------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------------------------------------------------------------
// INIT
// ---------------------------------------------------------------------
(async function init() {
  initTheme();
  try {
    await loadTasks();
  } catch (err) {
    document.getElementById('taskList').innerHTML =
      `<div class="empty-state" style="display:block"><p>Can't reach the server</p><span>Make sure the backend is running (npm start in /server), then refresh.</span></div>`;
    console.error('Failed to load tasks from API:', err);
    return;
  }
  renderAll();
})();

// Re-render charts on theme change so colors stay in sync
document.getElementById('themeToggle').addEventListener('click', () => setTimeout(() => {
  try { renderCharts(); } catch (err) { /* Chart.js unavailable — ignore */ }
}, 50));
