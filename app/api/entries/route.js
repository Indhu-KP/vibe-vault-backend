import { NextResponse } from 'next/server';
import { initializeDatabase, allQuery, runQuery } from '@/lib/db';
import { parseBearerToken, validateSession } from '@/lib/auth';

async function authorizeRequest(request) {
  const token = parseBearerToken(request.headers.get('authorization'));
  if (!token) {
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }

  const validation = await validateSession(token);
  if (!validation.valid) {
    return { authorized: false, error: validation.error };
  }

  return { authorized: true, userId: validation.userId };
}

export async function GET(request) {
  try {
    await initializeDatabase();
    const auth = await authorizeRequest(request);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const entries = await allQuery(
      `SELECT id, title, content, sentiment_score, created_at FROM entries 
       WHERE user_id = $1 ORDER BY created_at DESC`,
      [auth.userId]
    );

    return NextResponse.json(entries);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

export async function POST(request) {
  try {
    await initializeDatabase();
    const auth = await authorizeRequest(request);

    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const sentimentScore = typeof body.sentimentScore === 'number' ? body.sentimentScore : null;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      );
    }

    const result = await runQuery(
      `INSERT INTO entries (title, content, sentiment_score, user_id) 
       VALUES ($1, $2, $3, $4) RETURNING id, title, content, sentiment_score, created_at`,
      [title, content, sentimentScore, auth.userId]
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
