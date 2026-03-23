import { Pool } from 'pg';

let pool = null;
let dbInitError = null;

function getPool() {
  if (!pool) {
    const databaseUrl = process.env.SUPABASE_POOLER_URL
      || process.env.SUPABASE_DB_URL
      || process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('Missing required environment variable: SUPABASE_POOLER_URL, SUPABASE_DB_URL, or DATABASE_URL');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
      pool = null;
    });
  }

  return pool;
}

export async function initializeDatabase() {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        title_hash TEXT NOT NULL,
        title_salt TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entries (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        sentiment_score DOUBLE PRECISION,
        user_id TEXT NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ Connected to Supabase PostgreSQL');
    return true;
  } catch (error) {
    dbInitError = error.message;
    console.error('❌ Database initialization failed:', error.message);
    return false;
  }
}

export async function runQuery(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return {
    id: result.rows[0]?.id ?? null,
    changes: result.rowCount,
  };
}

export async function allQuery(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function getQuery(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

export function getDbError() {
  return dbInitError;
}
