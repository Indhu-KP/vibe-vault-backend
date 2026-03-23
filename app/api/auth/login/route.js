import { NextResponse } from 'next/server';
import { initializeDatabase, getQuery, runQuery } from '@/lib/db';
import { hashTitle, generateSessionToken } from '@/lib/auth';

export async function POST(request) {
  try {
    await initializeDatabase();
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const title = typeof body.title === 'string' ? body.title : '';

    if (!userId || !title) {
      return NextResponse.json(
        { error: 'userId and title are required' },
        { status: 400 }
      );
    }

    const user = await getQuery(
      'SELECT user_id, title_hash, title_salt FROM users WHERE user_id = $1',
      [userId]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const candidateHash = hashTitle(title, user.title_salt);
    if (candidateHash !== user.title_hash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = generateSessionToken();
    const expiresAtIso = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
    await runQuery(
      'INSERT INTO sessions (session_token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expiresAtIso]
    );

    return NextResponse.json({
      token,
      userId,
      expiresAt: expiresAtIso,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
