# Kanban Board + User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat task list with a 3-column Kanban board (To Do / In Progress / Completed) and add a hamburger menu with an "Add User" form.

**Architecture:** DB migration adds `status` to tasks and a new `users` table; the PATCH endpoint is extended to accept `status`; a new `/api/users` route handles user CRUD; `TasksView` is rewritten as a board; two new components (`HamburgerMenu`, `AddUserModal`) are wired into `page.jsx`.

**Tech Stack:** Next.js 14 App Router, React 18, better-sqlite3, nanoid (already installed)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/lib/db.js` | Modify | Add `status` migration, `users` table, update `rowToTask` |
| `app/api/tasks/[id]/route.js` | Modify | PATCH accepts `{ status }`, keeps `done` in sync |
| `app/api/users/route.js` | Create | GET list + POST create user |
| `app/lib/store.js` | Modify | Replace `toggleTask` → `moveTask`, add `createUser` |
| `app/components/TasksView.jsx` | Rewrite | 3-column Kanban board |
| `app/components/HamburgerMenu.jsx` | Create | ≡ button + dropdown |
| `app/components/AddUserModal.jsx` | Create | Add user form modal |
| `app/page.jsx` | Modify | Wire moveTask, HamburgerMenu, AddUserModal, toast |
| `app/globals.css` | Modify | Add board/hamburger/form/toast styles, remove list styles |

---

## Task 1: DB Migration — status column + users table + rowToTask

**Files:**
- Modify: `app/lib/db.js`

- [ ] **Step 1: Add status migration and users table to getDb()**

  Open `app/lib/db.js`. Replace the `db.exec(...)` block and the seed block with the following complete replacement of lines 17–45:

  ```js
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      text       TEXT NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      source     TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_group ON tasks(group_id);

    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name  TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrate: add status column to tasks if it doesn't exist yet
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo'`);
    db.exec(`UPDATE tasks SET status = 'done' WHERE done = 1`);
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Seed default group on first run
  const count = db.prepare('SELECT COUNT(*) AS c FROM groups').get().c;
  if (count === 0) {
    db.prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)').run(
      'default',
      'Personal',
      Date.now()
    );
  }
  ```

- [ ] **Step 2: Update rowToTask to include status**

  Replace the `rowToTask` function (lines 52–59) with:

  ```js
  export function rowToTask(row) {
    return {
      id: row.id,
      text: row.text,
      done: !!row.done,
      status: row.status || 'todo',
      source: row.source || undefined,
    };
  }
  ```

- [ ] **Step 3: Verify the migration runs without error**

  Start the dev server and confirm it starts without crashing:

  ```bash
  npm run dev
  ```

  Expected: server starts on port 3000 with no SQLite errors in the console. If an error appears, check the `ALTER TABLE` try/catch — the error message text must match `'duplicate column name'`.

  Stop the server (`Ctrl+C`) after confirming.

- [ ] **Step 4: Commit**

  ```bash
  git add app/lib/db.js
  git commit -m "feat: add status column migration and users table"
  ```

---

## Task 2: Extend PATCH /api/tasks/[id] to accept status

**Files:**
- Modify: `app/api/tasks/[id]/route.js`

- [ ] **Step 1: Rewrite the PATCH handler**

  Replace the entire contents of `app/api/tasks/[id]/route.js` with:

  ```js
  import { NextResponse } from 'next/server';
  import { getDb } from '../../../lib/db';

  export const dynamic = 'force-dynamic';

  const VALID_STATUSES = ['todo', 'inprogress', 'done'];

  export async function PATCH(req, { params }) {
    try {
      const { id } = params;
      if (!id) {
        return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
      }

      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { done, status } = body ?? {};

      let result;

      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return NextResponse.json(
            { error: '`status` must be one of: todo, inprogress, done' },
            { status: 400 }
          );
        }
        const doneValue = status === 'done' ? 1 : 0;
        result = getDb()
          .prepare('UPDATE tasks SET status = ?, done = ? WHERE id = ?')
          .run(status, doneValue, id);
      } else if (typeof done === 'boolean') {
        const statusValue = done ? 'done' : 'todo';
        result = getDb()
          .prepare('UPDATE tasks SET done = ?, status = ? WHERE id = ?')
          .run(done ? 1 : 0, statusValue, id);
      } else {
        return NextResponse.json(
          { error: 'Body must contain `status` (string) or `done` (boolean)' },
          { status: 400 }
        );
      }

      if (result.changes === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  export async function DELETE(_req, { params }) {
    try {
      const { id } = params;
      if (!id) {
        return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
      }
      const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
      if (result.changes === 0) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Verify the endpoint manually**

  Start the dev server (`npm run dev`), then in a separate terminal run the following. Replace `<TASK_ID>` with a real task id from your DB (visible at `http://localhost:3000`).

  Test new status path:
  ```bash
  curl -s -X PATCH http://localhost:3000/api/tasks/<TASK_ID> \
    -H "Content-Type: application/json" \
    -d '{"status":"inprogress"}' | cat
  ```
  Expected: `{"ok":true}`

  Test invalid status:
  ```bash
  curl -s -X PATCH http://localhost:3000/api/tasks/<TASK_ID> \
    -H "Content-Type: application/json" \
    -d '{"status":"invalid"}' | cat
  ```
  Expected: `{"error":"` status must be one of `..."}`

  Test legacy done path still works:
  ```bash
  curl -s -X PATCH http://localhost:3000/api/tasks/<TASK_ID> \
    -H "Content-Type: application/json" \
    -d '{"done":true}' | cat
  ```
  Expected: `{"ok":true}`

  Stop the server.

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/tasks/[id]/route.js
  git commit -m "feat: PATCH tasks accepts status field, keeps done in sync"
  ```

---

## Task 3: Create /api/users route

**Files:**
- Create: `app/api/users/route.js`

- [ ] **Step 1: Create the file**

  Create `app/api/users/route.js` with the following content:

  ```js
  import { NextResponse } from 'next/server';
  import { nanoid } from 'nanoid';
  import { getDb } from '../../lib/db';

  export const dynamic = 'force-dynamic';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  export async function GET() {
    try {
      const users = getDb()
        .prepare('SELECT id, first_name, last_name, email FROM users ORDER BY created_at ASC')
        .all();
      return NextResponse.json(users);
    } catch (err) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  export async function POST(req) {
    try {
      let body;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }

      const { firstName, lastName, email } = body ?? {};

      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
      }
      if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
      }

      const id = nanoid();
      const now = Date.now();

      try {
        getDb()
          .prepare(
            'INSERT INTO users (id, first_name, last_name, email, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(id, firstName.trim(), lastName.trim(), email.trim(), now);
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          return NextResponse.json({ error: 'A user with that email already exists' }, { status: 400 });
        }
        throw e;
      }

      return NextResponse.json(
        { id, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() },
        { status: 201 }
      );
    } catch (err) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
  ```

- [ ] **Step 2: Verify the endpoint manually**

  Start the dev server (`npm run dev`).

  Test POST success:
  ```bash
  curl -s -X POST http://localhost:3000/api/users \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com"}' | cat
  ```
  Expected: `{"id":"...","firstName":"Jane","lastName":"Doe","email":"jane@example.com"}` with HTTP 201.

  Test GET:
  ```bash
  curl -s http://localhost:3000/api/users | cat
  ```
  Expected: JSON array containing the user you just created.

  Test duplicate email:
  ```bash
  curl -s -X POST http://localhost:3000/api/users \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com"}' | cat
  ```
  Expected: `{"error":"A user with that email already exists"}`

  Test missing field:
  ```bash
  curl -s -X POST http://localhost:3000/api/users \
    -H "Content-Type: application/json" \
    -d '{"firstName":"Jane"}' | cat
  ```
  Expected: `{"error":"Last name is required"}`

  Stop the server.

- [ ] **Step 3: Commit**

  ```bash
  git add app/api/users/route.js
  git commit -m "feat: add GET and POST /api/users endpoint"
  ```

---

## Task 4: Update client store

**Files:**
- Modify: `app/lib/store.js`

- [ ] **Step 1: Replace toggleTask with moveTask and add createUser**

  Replace the entire contents of `app/lib/store.js` with:

  ```js
  // Client-side API wrapper for the SQLite-backed REST endpoints.
  // All functions throw on non-2xx responses.

  async function jsonFetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.error) msg = body.error;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  export const api = {
    loadState:    ()              => jsonFetch('/api/state'),

    createGroup:  (name)          => jsonFetch('/api/groups', {
                                       method: 'POST',
                                       body: JSON.stringify({ name }),
                                     }),

    deleteGroup:  (id)            => jsonFetch(`/api/groups/${id}`, {
                                       method: 'DELETE',
                                     }),

    createTask:   (groupId, text) => jsonFetch(`/api/groups/${groupId}/tasks`, {
                                       method: 'POST',
                                       body: JSON.stringify({ text }),
                                     }),

    importTasks:  (groupId, items) => jsonFetch(`/api/groups/${groupId}/tasks`, {
                                       method: 'POST',
                                       body: JSON.stringify({ items }),
                                     }),

    moveTask:     (id, status)    => jsonFetch(`/api/tasks/${id}`, {
                                       method: 'PATCH',
                                       body: JSON.stringify({ status }),
                                     }),

    deleteTask:   (id)            => jsonFetch(`/api/tasks/${id}`, {
                                       method: 'DELETE',
                                     }),

    createUser:   (data)          => jsonFetch('/api/users', {
                                       method: 'POST',
                                       body: JSON.stringify(data),
                                     }),
  };
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add app/lib/store.js
  git commit -m "feat: replace toggleTask with moveTask, add createUser in store"
  ```

---

## Task 5: Rewrite TasksView as Kanban board

**Files:**
- Rewrite: `app/components/TasksView.jsx`

- [ ] **Step 1: Replace the entire file**

  Replace the entire contents of `app/components/TasksView.jsx` with:

  ```jsx
  'use client';
  import { useState } from 'react';

  const COLUMNS = [
    { key: 'todo',       label: 'To Do' },
    { key: 'inprogress', label: 'In Progress' },
    { key: 'done',       label: 'Completed' },
  ];

  export default function TasksView({ group, tasks, onAdd, onMove, onDelete }) {
    const [text, setText] = useState('');

    const handleAdd = () => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onAdd(trimmed);
      setText('');
    };

    if (!group) {
      return <div className="empty-state">Select a group to view tasks.</div>;
    }

    return (
      <>
        <div className="add-task-row">
          <input
            type="text"
            placeholder={`Add a task to "${group.name}"...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button onClick={handleAdd}>Add</button>
        </div>

        <div className="board">
          {COLUMNS.map((col, colIndex) => {
            const colTasks = tasks.filter((t) => (t.status || 'todo') === col.key);
            return (
              <div key={col.key} className="board-col">
                <div className="board-col-header">
                  <span className="board-col-title">{col.label}</span>
                  <span className="count-badge">{colTasks.length}</span>
                </div>

                {colTasks.length === 0 ? (
                  <p className="board-col-empty">No tasks</p>
                ) : (
                  colTasks.map((t) => (
                    <div key={t.id} className="task-card">
                      <span className="task-card-text">{t.text}</span>
                      {t.source === 'gcal' && (
                        <span className="source-tag">Calendar</span>
                      )}
                      <div className="task-card-actions">
                        <button
                          className="move-btn"
                          title="Move left"
                          disabled={colIndex === 0}
                          onClick={() => onMove(t.id, COLUMNS[colIndex - 1].key)}
                        >
                          ←
                        </button>
                        <button
                          className="move-btn"
                          title="Move right"
                          disabled={colIndex === COLUMNS.length - 1}
                          onClick={() => onMove(t.id, COLUMNS[colIndex + 1].key)}
                        >
                          →
                        </button>
                        <button
                          className="del"
                          title="Delete"
                          onClick={() => onDelete(t.id)}
                        >
                          &#x2715;
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add app/components/TasksView.jsx
  git commit -m "feat: rewrite TasksView as 3-column Kanban board"
  ```

---

## Task 6: Create HamburgerMenu and AddUserModal components

**Files:**
- Create: `app/components/HamburgerMenu.jsx`
- Create: `app/components/AddUserModal.jsx`

- [ ] **Step 1: Create HamburgerMenu.jsx**

  Create `app/components/HamburgerMenu.jsx`:

  ```jsx
  'use client';
  import { useState, useEffect, useRef } from 'react';

  export default function HamburgerMenu({ onAddUser }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const handleClick = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
      <div className="hamburger-wrap" ref={wrapRef}>
        <button
          className="hamburger-btn"
          onClick={() => setOpen((v) => !v)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          &#9776;
        </button>
        {open && (
          <div className="hamburger-dropdown">
            <button
              onClick={() => {
                setOpen(false);
                onAddUser();
              }}
            >
              Add User
            </button>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 2: Create AddUserModal.jsx**

  Create `app/components/AddUserModal.jsx`:

  ```jsx
  'use client';
  import { useState } from 'react';
  import { api } from '../lib/store';

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  export default function AddUserModal({ open, onClose, onSuccess }) {
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
    const [errors, setErrors] = useState({});
    const [serverError, setServerError] = useState('');
    const [saving, setSaving] = useState(false);

    if (!open) return null;

    const validate = () => {
      const e = {};
      if (!form.firstName.trim()) e.firstName = 'First name is required';
      if (!form.lastName.trim()) e.lastName = 'Last name is required';
      if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) {
        e.email = 'A valid email is required';
      }
      return e;
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      setServerError('');
      const errs = validate();
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setErrors({});
      setSaving(true);
      try {
        await api.createUser({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
        });
        setForm({ firstName: '', lastName: '', email: '' });
        onSuccess(`User ${form.firstName.trim()} ${form.lastName.trim()} added successfully`);
      } catch (err) {
        setServerError(err.message);
      } finally {
        setSaving(false);
      }
    };

    const handleClose = () => {
      setForm({ firstName: '', lastName: '', email: '' });
      setErrors({});
      setServerError('');
      onClose();
    };

    return (
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-user-title">
          <div className="modal-header">
            <h3 id="add-user-title">Add User</h3>
            <button className="close" onClick={handleClose} aria-label="Close">&times;</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {serverError && (
                <div className="form-server-error">{serverError}</div>
              )}
              <div className="form-field">
                <label htmlFor="firstName">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  autoFocus
                />
                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
                {errors.lastName && <span className="field-error">{errors.lastName}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add app/components/HamburgerMenu.jsx app/components/AddUserModal.jsx
  git commit -m "feat: add HamburgerMenu and AddUserModal components"
  ```

---

## Task 7: Wire everything into page.jsx

**Files:**
- Modify: `app/page.jsx`

- [ ] **Step 1: Replace the entire file**

  Replace the entire contents of `app/page.jsx` with:

  ```jsx
  'use client';
  import { useState, useEffect, useMemo } from 'react';
  import Sidebar from './components/Sidebar';
  import TasksView from './components/TasksView';
  import CalendarImportModal from './components/CalendarImportModal';
  import HamburgerMenu from './components/HamburgerMenu';
  import AddUserModal from './components/AddUserModal';
  import { api } from './lib/store';

  export default function Home() {
    const [state, setState] = useState(null); // { groups, tasks }
    const [selectedId, setSelectedId] = useState(null);
    const [calOpen, setCalOpen] = useState(false);
    const [error, setError] = useState('');
    const [userModalOpen, setUserModalOpen] = useState(false);
    const [successToast, setSuccessToast] = useState(null);

    // Auto-clear toast after 3 seconds
    useEffect(() => {
      if (!successToast) return;
      const t = setTimeout(() => setSuccessToast(null), 3000);
      return () => clearTimeout(t);
    }, [successToast]);

    // Initial load from server
    useEffect(() => {
      api
        .loadState()
        .then((s) => {
          setState(s);
          setSelectedId(s.groups[0]?.id || null);
        })
        .catch((e) => setError(e.message));
    }, []);

    const selectedGroup = useMemo(
      () => state?.groups.find((g) => g.id === selectedId) || null,
      [state, selectedId]
    );

    const currentTasks = useMemo(
      () => (state && selectedId ? state.tasks[selectedId] || [] : []),
      [state, selectedId]
    );

    const taskCounts = useMemo(() => {
      if (!state) return {};
      const counts = {};
      for (const g of state.groups) counts[g.id] = (state.tasks[g.id] || []).length;
      return counts;
    }, [state]);

    // ----- group ops -----
    const addGroup = async (name) => {
      try {
        const newGroup = await api.createGroup(name);
        setState((s) => ({
          groups: [...s.groups, newGroup],
          tasks: { ...s.tasks, [newGroup.id]: [] },
        }));
      } catch (e) {
        setError(e.message);
      }
    };

    const deleteGroup = async (id) => {
      try {
        await api.deleteGroup(id);
        setState((s) => {
          const groups = s.groups.filter((g) => g.id !== id);
          const tasks = { ...s.tasks };
          delete tasks[id];
          return { groups, tasks };
        });
        if (selectedId === id) {
          const remaining = state.groups.filter((g) => g.id !== id);
          setSelectedId(remaining[0]?.id || null);
        }
      } catch (e) {
        setError(e.message);
      }
    };

    // ----- task ops -----
    const addTask = async (text) => {
      if (!selectedId) return;
      try {
        const task = await api.createTask(selectedId, text);
        setState((s) => ({
          ...s,
          tasks: { ...s.tasks, [selectedId]: [task, ...(s.tasks[selectedId] || [])] },
        }));
      } catch (e) {
        setError(e.message);
      }
    };

    const moveTask = async (id, status) => {
      if (!selectedId) return;
      // Optimistic update
      setState((s) => ({
        ...s,
        tasks: {
          ...s.tasks,
          [selectedId]: s.tasks[selectedId].map((t) =>
            t.id === id ? { ...t, status } : t
          ),
        },
      }));
      try {
        await api.moveTask(id, status);
      } catch (e) {
        // Revert
        setState((s) => ({
          ...s,
          tasks: {
            ...s.tasks,
            [selectedId]: s.tasks[selectedId].map((t) =>
              t.id === id ? { ...t, status: t.status } : t
            ),
          },
        }));
        setError(e.message);
      }
    };

    const deleteTask = async (id) => {
      try {
        await api.deleteTask(id);
        setState((s) => ({
          ...s,
          tasks: {
            ...s.tasks,
            [selectedId]: s.tasks[selectedId].filter((t) => t.id !== id),
          },
        }));
      } catch (e) {
        setError(e.message);
      }
    };

    const importCalendarEvents = async (events) => {
      if (!selectedId || events.length === 0) return;
      try {
        const { tasks: newTasks } = await api.importTasks(
          selectedId,
          events.map((e) => ({ text: e.summary, source: 'gcal' }))
        );
        setState((s) => ({
          ...s,
          tasks: {
            ...s.tasks,
            [selectedId]: [...newTasks, ...(s.tasks[selectedId] || [])],
          },
        }));
      } catch (e) {
        setError(e.message);
      }
    };

    if (!state) {
      return (
        <div style={{ padding: 40 }}>
          {error ? `Error: ${error}` : 'Loading…'}
        </div>
      );
    }

    return (
      <div className="app-shell">
        <Sidebar
          groups={state.groups}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={addGroup}
          onDelete={deleteGroup}
          taskCounts={taskCounts}
        />

        <main className="main">
          <div className="main-header">
            <h1>{selectedGroup ? selectedGroup.name : 'Tasks'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="gcal-btn" onClick={() => setCalOpen(true)} disabled={!selectedGroup}>
                <span className="gcal-dot" />
                Import from Google Calendar
              </button>
              <HamburgerMenu onAddUser={() => setUserModalOpen(true)} />
            </div>
          </div>

          {successToast && <div className="toast">{successToast}</div>}

          {error && (
            <div style={{
              background: '#ffe5e5', color: '#c0392b', padding: '8px 12px',
              borderRadius: 6, marginBottom: 12, fontSize: '0.85rem',
            }}>
              {error} <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>&times;</button>
            </div>
          )}

          <TasksView
            group={selectedGroup}
            tasks={currentTasks}
            onAdd={addTask}
            onMove={moveTask}
            onDelete={deleteTask}
          />
        </main>

        <CalendarImportModal
          open={calOpen}
          onClose={() => setCalOpen(false)}
          onImport={importCalendarEvents}
          targetGroupName={selectedGroup?.name}
        />

        <AddUserModal
          open={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          onSuccess={(msg) => {
            setUserModalOpen(false);
            setSuccessToast(msg);
          }}
        />
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  git add app/page.jsx
  git commit -m "feat: wire moveTask, HamburgerMenu, AddUserModal and toast into page"
  ```

---

## Task 8: Update globals.css — board, hamburger, form, toast styles

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Remove old task-list and task-pager styles**

  In `app/globals.css`, delete the following blocks entirely (lines ~223–300):

  ```css
  .task-list { ... }
  .task-list li { ... }
  .task-list li:last-child { ... }
  .task-list input[type="checkbox"] { ... }
  .task-list .task-text { ... }
  .task-list li.done .task-text { ... }
  .task-list .source-tag { ... }
  .task-list .del { ... }
  .task-pager { ... }
  .task-pager button { ... }
  .task-pager button:disabled { ... }
  .task-pager button:not(:disabled):hover { ... }
  ```

- [ ] **Step 2: Append new styles at the end of the file**

  Add the following to the end of `app/globals.css`:

  ```css
  /* ------- Kanban Board ------- */
  .board {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .board-col {
    flex: 1;
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    min-height: 200px;
    display: flex;
    flex-direction: column;
  }

  .board-col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #f0f0f5;
  }

  .board-col-title {
    font-weight: 700;
    font-size: 0.92rem;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #555;
  }

  .board-col-empty {
    color: #bbb;
    font-size: 0.85rem;
    text-align: center;
    padding: 24px 16px;
  }

  .task-card {
    padding: 12px 14px;
    border-bottom: 1px solid #f5f5fa;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-card:last-child { border-bottom: none; }

  .task-card-text {
    font-size: 0.92rem;
    line-height: 1.4;
    word-break: break-word;
  }

  .task-card-actions {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .move-btn {
    background: none;
    border: 1.5px solid #e0e0e8;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #555;
  }

  .move-btn:hover:not(:disabled) { border-color: #6c63ff; color: #6c63ff; }
  .move-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  .task-card .del {
    margin-left: auto;
    background: none;
    border: none;
    color: #ccc;
    cursor: pointer;
    font-size: 1rem;
    padding: 4px 6px;
    border-radius: 4px;
  }

  .task-card .del:hover { color: #e74c3c; }

  .task-card .source-tag {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    background: #eef1ff;
    color: #6c63ff;
    font-weight: 600;
    align-self: flex-start;
  }

  /* ------- Hamburger Menu ------- */
  .hamburger-wrap {
    position: relative;
  }

  .hamburger-btn {
    padding: 9px 14px;
    background: #fff;
    color: #1a1a2e;
    border: 1.5px solid #e0e0e8;
    border-radius: 8px;
    font-size: 1.1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hamburger-btn:hover { border-color: #6c63ff; color: #6c63ff; }

  .hamburger-dropdown {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    background: #fff;
    border: 1.5px solid #e0e0e8;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.10);
    min-width: 160px;
    z-index: 50;
    overflow: hidden;
  }

  .hamburger-dropdown button {
    display: block;
    width: 100%;
    padding: 11px 16px;
    text-align: left;
    background: none;
    border: none;
    font-size: 0.92rem;
    cursor: pointer;
    color: #1a1a2e;
  }

  .hamburger-dropdown button:hover { background: #f5f5fa; }

  /* ------- User Form ------- */
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 14px;
  }

  .form-field label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #444;
  }

  .form-field input {
    padding: 10px 12px;
    border: 1.5px solid #e0e0e8;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    font-family: inherit;
  }

  .form-field input:focus { border-color: #6c63ff; }

  .field-error {
    font-size: 0.8rem;
    color: #e74c3c;
  }

  .form-server-error {
    background: #ffe5e5;
    color: #c0392b;
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 14px;
    font-size: 0.85rem;
  }

  /* ------- Toast ------- */
  .toast {
    background: #2ecc71;
    color: #fff;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 0.88rem;
    font-weight: 600;
    margin-bottom: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  }
  ```

- [ ] **Step 3: Verify the full UI in the browser**

  Run `npm run dev` and open `http://localhost:3000`. Check:

  - [ ] Tasks appear in 3 columns — all existing tasks land in **To Do** (new) or **Completed** (previously done)
  - [ ] The ← / → arrow buttons on task cards move them between columns; the leftmost column's ← is disabled and the rightmost column's → is disabled
  - [ ] Adding a new task via the input always places it in **To Do**
  - [ ] Clicking ≡ in the top-right opens a dropdown with "Add User"
  - [ ] Clicking "Add User" opens the modal; submitting with empty fields shows inline errors
  - [ ] Submitting a valid new user closes the modal and shows a green toast for 3 seconds
  - [ ] Submitting a duplicate email shows the server error message inside the modal
  - [ ] Clicking outside the modal or pressing Cancel clears and closes it

- [ ] **Step 4: Commit**

  ```bash
  git add app/globals.css
  git commit -m "feat: add board, hamburger, form, and toast styles; remove task-list styles"
  ```
