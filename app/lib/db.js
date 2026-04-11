import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db = null;

export function getDb() {
  if (db) return db;

  const dataDir = process.env.TODO_DATA_DIR
    ? path.resolve(process.env.TODO_DATA_DIR)
    : path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(path.join(dataDir, 'todo.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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

  return db;
}

// ----- Helpers -----

export function rowToTask(row) {
  return {
    id: row.id,
    text: row.text,
    done: !!row.done,
    status: row.status || 'todo',
    source: row.source || undefined,
  };
}

export function getAllState() {
  const d = getDb();
  const groups = d
    .prepare('SELECT id, name FROM groups ORDER BY created_at ASC')
    .all();

  const tasks = {};
  for (const g of groups) {
    tasks[g.id] = d
      .prepare(
        'SELECT id, text, done, source, status FROM tasks WHERE group_id = ? ORDER BY created_at DESC'
      )
      .all(g.id)
      .map(rowToTask);
  }
  return { groups, tasks };
}
