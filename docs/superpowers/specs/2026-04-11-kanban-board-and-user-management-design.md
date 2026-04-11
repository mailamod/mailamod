# Design: Kanban Board View + User Management

**Date:** 2026-04-11
**Status:** Approved

---

## Overview

Two features are being added to the mailamod Next.js to-do app:

1. **Kanban board** — replace the flat paginated task list with a 3-column board (To Do / In Progress / Completed)
2. **User management** — hamburger menu in the top-right corner with an "Add User" form (first name, last name, email)

No new npm packages. Uses only: React, Next.js App Router, better-sqlite3, nanoid.

---

## Feature 1 — Kanban Board

### Database (`app/lib/db.js`)

Add a `status TEXT` column to the `tasks` table. Because the DB may already exist, use a safe migration pattern on every init:

```sql
ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'todo';
UPDATE tasks SET status = 'done' WHERE done = 1;
```

Wrap the `ALTER TABLE` in a try/catch (SQLite throws if the column already exists) — if it throws with "duplicate column name", swallow the error and continue.

`rowToTask` gains a `status` field:

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

All existing SELECT queries that return tasks already select the full row, so `status` will be available once the column exists.

### Users table (`app/lib/db.js`)

Created in the same `db.exec` block:

```sql
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
```

### API — PATCH /api/tasks/[id] (`app/api/tasks/[id]/route.js`)

Accept either `{ done: boolean }` (legacy) or `{ status: 'todo' | 'inprogress' | 'done' }` (new). When `status` is present:

- Validate it is one of the three allowed values
- Compute `done = status === 'done' ? 1 : 0`
- Run `UPDATE tasks SET status = ?, done = ? WHERE id = ?`

When only `done` is present (legacy path), also sync `status`:
- `status = done ? 'done' : 'todo'`
- Run `UPDATE tasks SET done = ?, status = ? WHERE id = ?`

This keeps both columns in sync regardless of which field the caller provides.

### API — GET+POST /api/users (`app/api/users/route.js`)

New file.

**GET** — returns `SELECT id, first_name, last_name, email FROM users ORDER BY created_at ASC` as JSON array.

**POST** — body: `{ firstName, lastName, email }`
- Validate all three fields are non-empty strings
- Validate email with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- On failure: `{ error }` with status 400
- On success: insert with `nanoid()` id, return the new user object with status 201

### Client store (`app/lib/store.js`)

- Replace `toggleTask(id, done)` with `moveTask(id, status)` — sends `PATCH /api/tasks/${id}` with `{ status }`
- Add `createUser({ firstName, lastName, email })` — sends `POST /api/users`

### TasksView (`app/components/TasksView.jsx`)

- Remove pagination entirely
- Render a `.board` flex container with three `.board-col` children
- Column order: **To Do** (`todo`) → **In Progress** (`inprogress`) → **Completed** (`done`)
- Each column has a header with the column name and a task count badge
- Each task renders as a `.task-card`:
  - Task text
  - Optional `.source-tag` for gcal tasks
  - Left arrow button (disabled on leftmost column) to move one column back
  - Right arrow button (disabled on rightmost column) to move one column forward
  - Delete button (×)
- The "Add task" input row stays at top and always creates tasks with `status: 'todo'` (unchanged from current behavior)
- Props: remove `onToggle`, add `onMove(taskId, newStatus)`

### page.jsx

- Replace `toggleTask` implementation with `moveTask(id, status)`:
  - Optimistic update: change task's `status` in local state immediately
  - Call `api.moveTask(id, status)`
  - On error: revert state and set error message
- Remove `onToggle` prop from `<TasksView>`, add `onMove={moveTask}`

---

## Feature 2 — Hamburger Menu + User Management

### HamburgerMenu (`app/components/HamburgerMenu.jsx`)

A self-contained component that renders:
- A `.hamburger-btn` button (≡) that toggles a `.hamburger-dropdown`
- The dropdown contains a single item: "Add User"
- Clicking outside the dropdown closes it (via `useEffect` + `mousedown` listener on `document`)
- Props: `onAddUser` — called when "Add User" is clicked (also closes the dropdown)

### AddUserModal (`app/components/AddUserModal.jsx`)

- Rendered when `userModalOpen` is true in page.jsx
- Uses the existing `.modal-backdrop` / `.modal` / `.modal-header` / `.modal-body` / `.modal-footer` CSS classes
- Form fields: First Name, Last Name, Email — each with a label, input, and inline `.field-error` span shown only when validation fails
- Validation runs on submit (not on every keystroke)
- On submit: calls `api.createUser(...)`, on success closes modal and passes a success message up to page.jsx, on error shows a top-of-form error message
- Props: `open`, `onClose`, `onSuccess(message)`

### page.jsx changes

- State additions: `menuOpen` (boolean), `userModalOpen` (boolean), `successToast` (string | null)
- `successToast` auto-clears after 3 seconds via `useEffect`
- In `.main-header`: add `<HamburgerMenu onAddUser={() => setUserModalOpen(true)} />` alongside the gcal button
- Below the header: render a `.toast` div when `successToast` is set
- At the bottom of JSX: render `<AddUserModal open={userModalOpen} onClose={() => setUserModalOpen(false)} onSuccess={(msg) => { setUserModalOpen(false); setSuccessToast(msg); }} />`

### CSS (`app/globals.css`)

**Add:**

```
.board               — display:flex, gap, align-items:flex-start
.board-col           — flex:1, background:#fff, border-radius, padding, min-height
.board-col-header    — column title + count badge, border-bottom
.task-card           — card with text, tags, and action buttons
.move-btn            — small arrow button for moving cards between columns
.hamburger-btn       — the ≡ trigger button, styled like .gcal-btn
.hamburger-wrap      — position:relative container for button + dropdown
.hamburger-dropdown  — absolute-positioned white card, box-shadow, z-index
.hamburger-dropdown button — full-width menu items
.form-field          — label + input stack with margin
.field-error         — small red error text below an input
.toast               — fixed bottom-right success notification, auto-dismiss
```

**Remove:** `.task-list`, `.task-list li`, `.task-list input[type="checkbox"]`, `.task-list .task-text`, `.task-list li.done .task-text`, `.task-list .source-tag`, `.task-list .del`, `.task-pager` and its children — these are replaced by the board styles.

---

## Files Changed

| File | Change |
|------|--------|
| `app/lib/db.js` | Add `status` column migration, `users` table, update `rowToTask` |
| `app/api/tasks/[id]/route.js` | PATCH accepts `status`, syncs `done` |
| `app/api/users/route.js` | New — GET + POST |
| `app/lib/store.js` | Replace `toggleTask` with `moveTask`, add `createUser` |
| `app/components/TasksView.jsx` | Full rewrite — Kanban board layout |
| `app/components/HamburgerMenu.jsx` | New |
| `app/components/AddUserModal.jsx` | New |
| `app/page.jsx` | Wire `moveTask`, `HamburgerMenu`, `AddUserModal`, toast |
| `app/globals.css` | Add board/hamburger/form/toast styles, remove list styles |

---

## Error Handling

- All API routes already wrap in try/catch and return 500 on unexpected errors — maintain this pattern
- Optimistic UI updates in page.jsx revert on API failure
- AddUserModal shows server-returned error messages inline (e.g. duplicate email)

## Out of Scope

- Drag-and-drop between columns (arrow buttons used instead)
- Listing or deleting users (Add only for now)
- Authentication / user login
