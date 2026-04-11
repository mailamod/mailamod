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
    const db = getDb();
    let result;

    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: '`status` must be one of: todo, inprogress, done' },
          { status: 400 }
        );
      }
      const doneValue = status === 'done' ? 1 : 0;
      result = db
        .prepare('UPDATE tasks SET status = ?, done = ? WHERE id = ?')
        .run(status, doneValue, id);
    } else if (typeof done === 'boolean') {
      const statusValue = done ? 'done' : 'todo';
      result = db
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
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
