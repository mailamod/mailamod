import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(_req, { params }) {
  try {
    const { id } = params;
    const result = getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
