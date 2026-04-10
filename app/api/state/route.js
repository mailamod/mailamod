import { NextResponse } from 'next/server';
import { getAllState } from '../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = getAllState();
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
