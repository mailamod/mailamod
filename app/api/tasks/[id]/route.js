import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// PATCH: toggle done. Body: { done: boolean }
export async function PATCH(req, { params }) {
  try {
    const { id } = params;
    const { done } = await req.json();
    const result = getDb()
      .prepare('UPDATE tasks SET done = ? WHERE id = ?')
      .run(done ? 1 : 0, id);
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
    const result = getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
