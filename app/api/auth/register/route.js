import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { initializeDatabase, getQuery, runQuery } from '@/lib/db';
import { hashTitle } from '@/lib/auth';

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

    if (userId.length > 80 || title.length > 200) {
      return NextResponse.json(
        { error: 'userId or title is too long' },
        { status: 400 }
      );
    }

    const existing = await getQuery(
      'SELECT user_id FROM users WHERE user_id = $1',
      [userId]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const titleHash = hashTitle(title, salt);
    await runQuery(
      'INSERT INTO users (user_id, title_hash, title_salt) VALUES ($1, $2, $3)',
      [userId, titleHash, salt]
    );

    return NextResponse.json(
      { message: 'User registered successfully' },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}
