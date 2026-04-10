# cursor.md

Project guide for AI coding assistants. Keep this short — link out, don't duplicate.

## What this is
A grouped to-do app built with **Next.js 14 (App Router)** + **React 18**, persisted to **SQLite** via `better-sqlite3`, with optional **Google Calendar** import.

## Stack
- Next.js 14.2.5 (App Router, JSX — no TypeScript)
- React 18.3.1
- better-sqlite3 12.x (synchronous, prebuilt binaries)
- No CSS framework — plain CSS in `app/globals.css`
- Google Identity Services + Calendar REST API (client-side OAuth)

## Run
```bash
npm install
npm run dev          # http://localhost:3000
```
DB file is auto-created at `data/todo.db` on first request. Default group "Personal" is seeded.

## Layout
```
app/
  layout.jsx                       Root layout
  page.jsx                         Main page — state, wiring, async API ops
  globals.css                      All styles
  components/
    Sidebar.jsx                    Groups list, add, pagination (10/page)
    TasksView.jsx                  Tasks list, add, pagination (20/page)
    CalendarImportModal.jsx        OAuth flow + event picker
  lib/
    db.js                          SQLite singleton + schema + helpers
    store.js                       Client-side fetch wrapper (api.*)
    gcal.js                        Google Identity Services + Calendar API
  api/
    state/route.js                 GET full {groups, tasks}
    groups/route.js                POST new group
    groups/[id]/route.js           DELETE group (cascades tasks)
    groups/[id]/tasks/route.js     POST single task or batch {items: [...]}
    tasks/[id]/route.js            PATCH toggle done, DELETE
data/todo.db                       SQLite file (gitignored)
```

## Schema
```sql
groups(id TEXT PK, name TEXT, created_at INTEGER)
tasks (id TEXT PK,
       group_id TEXT FK→groups ON DELETE CASCADE,
       text TEXT, done INTEGER, source TEXT, created_at INTEGER)
```
- `tasks.source = 'gcal'` marks calendar-imported tasks (rendered with a "Calendar" badge).
- WAL mode + `foreign_keys = ON` enabled in `db.js`.

## Conventions
- **All mutations go through API routes.** Never touch the DB from client components.
- **Client state shape** mirrors the API: `{ groups: [{id, name}], tasks: { [groupId]: [{id, text, done, source?}] } }`.
- **Optimistic updates** for toggles (see `toggleTask` in `page.jsx`); revert on error.
- **IDs are string-based** (`g_<ts>_<rnd>`, `t_<ts>_<rnd>`) — generated server-side.
- **Pagination is client-side** (Sidebar = 10 groups/page, TasksView = 20 tasks/page). All data is loaded up front via `/api/state`.
- API routes use `export const dynamic = 'force-dynamic'` to opt out of caching.
- Error responses: `{ error: string }` with appropriate status code.

## Google Calendar setup
Optional. To enable:
1. Create OAuth 2.0 Client ID (Web app) at console.cloud.google.com
2. Add `http://localhost:3000` to Authorized JavaScript origins
3. Create `.env.local` with `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...`

The flow runs entirely client-side using Google Identity Services (`https://accounts.google.com/gsi/client`) — no backend OAuth handling. Scope: `calendar.readonly`.

## Things to know / gotchas
- `npm run dev` via `preview_start` on Windows can be flaky — `launch.json` invokes `node node_modules/next/dist/bin/next dev` directly to avoid the `npm.cmd` shim.
- `better-sqlite3` ships prebuilt binaries — no compile step needed on Node 24.
- Deleting the last group is blocked in the UI (sidebar hides the delete button when `groups.length === 1`); the API itself does not enforce this.
- Calendar imports are tagged `source: 'gcal'` and added to the **currently selected** group.

## Backup / reset
- **Backup:** copy `data/todo.db`
- **Reset:** delete `data/todo.db` — schema and default group are recreated on next request

## Don't
- Don't add a frontend state library (Redux/Zustand) — `useState` in `page.jsx` is enough at this size.
- Don't introduce TypeScript without converting all files at once.
- Don't commit `data/`, `.next/`, `.env.local`, or `node_modules/` (already in `.gitignore`).
