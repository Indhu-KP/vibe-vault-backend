import { NextResponse } from 'next/server';
import { initializeDatabase, getDbError } from '@/lib/db';

export async function GET() {
  const initialized = await initializeDatabase();

  if (!initialized) {
    return NextResponse.json(
      {
        ok: false,
        error: getDbError() || 'Database initialization failed',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
