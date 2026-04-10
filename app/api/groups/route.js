import { NextResponse } from 'next/server';
import { getDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const { name } = await req.json();
    const trimmed = (name || '').trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    getDb()
      .prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)')
      .run(id, trimmed, Date.now());
    return NextResponse.json({ id, name: trimmed });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
