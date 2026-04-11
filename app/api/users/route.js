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
    return NextResponse.json({ error: err.message }, { status: 500 });
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
