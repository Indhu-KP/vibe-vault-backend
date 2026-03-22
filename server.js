require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.PORT) || 5000;
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

const isLocalPg = /localhost|127\.0\.0\.1/.test(connectionString);
let pool = null;
let poolInitError = null;

function initializePool() {
    if (pool) return pool;
    if (!connectionString) {
        poolInitError = new Error('Missing DATABASE_URL (or SUPABASE_DB_URL)');
        return null;
    }

    pool = new Pool({
        connectionString,
        ssl: isLocalPg ? false : { rejectUnauthorized: false },
        max: 10,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        maxUses: 7500,
    });

    pool.on('error', (err) => {
        console.error('PostgreSQL pool error:', err.message);
    });

    return pool;
}

// Initialize pool asynchronously on first boot
let poolReady = false;
const poolPromise = (async () => {
    try {
        initializePool();
        if (pool) {
            await pool.query('SELECT NOW()');
            poolReady = true;
            console.log('Database pool initialized successfully');
        }
    } catch (err) {
        console.error('Failed to initialize pool:', err.message);
    }
})();


async function dbQuery(text, params = []) {
    const activePool = initializePool();
    if (!activePool) {
        throw new Error('Database not configured: ' + (poolInitError?.message || 'Unknown error'));
    }
    const result = await pool.query(text, params);
    return result;
}

function hashTitle(title, salt) {
    return crypto.scryptSync(title, salt, 64).toString('hex');
}

function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

function parseBearerToken(headerValue) {
    if (!headerValue || typeof headerValue !== 'string') return null;
    const [scheme, token] = headerValue.split(' ');
    if (scheme !== 'Bearer' || !token) return null;
    return token.trim();
}

async function requireAuth(req, res, next) {
    try {
        const token = parseBearerToken(req.headers.authorization);
        if (!token) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const sessionResult = await dbQuery(
            `SELECT session_token, user_id, expires_at FROM sessions WHERE session_token = $1 LIMIT 1`,
            [token]
        );
        const session = sessionResult.rows[0];

        if (!session) {
            return res.status(401).json({ error: 'Invalid session token' });
        }

        const now = Date.now();
        const expiresAt = new Date(session.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
            await dbQuery(`DELETE FROM sessions WHERE session_token = $1`, [token]);
            return res.status(401).json({ error: 'Session expired. Please log in again.' });
        }

        req.userId = session.user_id;
        req.sessionToken = token;
        return next();
    } catch (error) {
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

// AUTH: Register with userId + title (title acts as secret credential)
app.post('/api/auth/register', async (req, res) => {
    const userId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    const title = typeof req.body.title === 'string' ? req.body.title : '';

    if (!userId || !title) {
        return res.status(400).json({ error: 'userId and title are required' });
    }

    if (userId.length > 80 || title.length > 200) {
        return res.status(400).json({ error: 'userId or title is too long' });
    }

    try {
        const existingResult = await dbQuery(
            `SELECT user_id FROM users WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        const existing = existingResult.rows[0];

        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const titleHash = hashTitle(title, salt);
        await dbQuery(
            `INSERT INTO users (user_id, title_hash, title_salt) VALUES ($1, $2, $3)`,
            [userId, titleHash, salt]
        );

        return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

// AUTH: Login with userId + title, returns bearer token
app.post('/api/auth/login', async (req, res) => {
    const userId = typeof req.body.userId === 'string' ? req.body.userId.trim() : '';
    const title = typeof req.body.title === 'string' ? req.body.title : '';

    if (!userId || !title) {
        return res.status(400).json({ error: 'userId and title are required' });
    }

    try {
        const userResult = await dbQuery(
            `SELECT user_id, title_hash, title_salt FROM users WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        const user = userResult.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const candidateHash = hashTitle(title, user.title_salt);
        if (candidateHash !== user.title_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateSessionToken();
        const expiresAtIso = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
        await dbQuery(
            `INSERT INTO sessions (session_token, user_id, expires_at) VALUES ($1, $2, $3)`,
            [token, userId, expiresAtIso]
        );

        return res.json({
            token,
            userId,
            expiresAt: expiresAtIso,
        });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

// AUTH: Logout current session
app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        await dbQuery(`DELETE FROM sessions WHERE session_token = $1`, [req.sessionToken]);
        return res.json({ message: 'Logged out successfully' });
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

// POST: Save a new diary entry
app.post('/api/entries', requireAuth, async (req, res) => {
    const { title, content, sentiment, sentiment_score } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'content is required' });
    }

    try {
        const resolvedTitle = title?.trim() || 'Untitled';
        const resolvedSentiment = sentiment_score ?? sentiment ?? null;

        const insertResult = await dbQuery(
            `INSERT INTO entries (title, content, sentiment_score, user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, title, content, sentiment_score, user_id, created_at`,
            [resolvedTitle, content, resolvedSentiment, req.userId]
        );
        const insertedEntry = insertResult.rows[0];

        res.status(201).json({
            message: 'Entry Saved!',
            data: insertedEntry,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET: Fetch all entries for a user
app.get('/api/entries', requireAuth, async (req, res) => {
    try {
        const dataResult = await dbQuery(
            `SELECT * FROM entries WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(dataResult.rows);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', storage: 'postgres' });
});

if (require.main === module) {
    app.listen(port, () => console.log(`Server active on port ${port}`));
}

module.exports = app;