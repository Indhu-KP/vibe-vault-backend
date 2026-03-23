import { NextResponse } from 'next/server';
import { initializeDatabase, runQuery } from '@/lib/db';
import { parseBearerToken, validateSession } from '@/lib/auth';

export async function POST(request) {
  try {
    await initializeDatabase();
    const token = parseBearerToken(request.headers.get('authorization'));

    if (!token) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const validation = await validateSession(token);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      );
    }

    await runQuery('DELETE FROM sessions WHERE session_token = $1', [token]);
    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
