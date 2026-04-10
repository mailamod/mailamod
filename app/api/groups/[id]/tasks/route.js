import { NextResponse } from 'next/server';
import { getDb, rowToTask } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// POST: create one task or batch import.
// Body: { text } OR { items: [{ text, source }] }
export async function POST(req, { params }) {
  try {
    const { id: groupId } = params;
    const body = await req.json();

    const db = getDb();
    const groupExists = db
      .prepare('SELECT 1 FROM groups WHERE id = ?')
      .get(groupId);
    if (!groupExists) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const insert = db.prepare(
      'INSERT INTO tasks (id, group_id, text, done, source, created_at) VALUES (?, ?, ?, 0, ?, ?)'
    );

    if (Array.isArray(body.items)) {
      const created = [];
      const txn = db.transaction((items) => {
        for (const it of items) {
          const text = (it.text || '').trim();
          if (!text) continue;
          const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          insert.run(id, groupId, text, it.source || null, Date.now());
          created.push({ id, text, done: false, source: it.source || undefined });
        }
      });
      txn(body.items);
      return NextResponse.json({ tasks: created });
    }

    const text = (body.text || '').trim();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    insert.run(id, groupId, text, body.source || null, Date.now());
    return NextResponse.json({
      id,
      text,
      done: false,
      source: body.source || undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
