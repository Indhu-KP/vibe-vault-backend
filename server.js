require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

const { DB_PATH, PORT } = process.env;

if (!DB_PATH) {
    console.error('Missing required environment variable: DB_PATH');
    process.exit(1);
}

if (!PORT) {
    console.error('Missing required environment variable: PORT');
    process.exit(1);
}

const dbPath = DB_PATH;
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database:', err.message);
        process.exit(1);
    }
    console.log(`Connected to SQLite at ${dbPath}`);
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            title_hash TEXT NOT NULL,
            title_salt TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
            session_token TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            sentiment_score REAL,
            user_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

function runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

function allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

function getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
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

        const session = await getQuery(
            `SELECT session_token, user_id, expires_at FROM sessions WHERE session_token = ?`,
            [token]
        );

        if (!session) {
            return res.status(401).json({ error: 'Invalid session token' });
        }

        const now = Date.now();
        const expiresAt = new Date(session.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= now) {
            await runQuery(`DELETE FROM sessions WHERE session_token = ?`, [token]);
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
        const existing = await getQuery(`SELECT user_id FROM users WHERE user_id = ?`, [userId]);
        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const titleHash = hashTitle(title, salt);
        await runQuery(
            `INSERT INTO users (user_id, title_hash, title_salt) VALUES (?, ?, ?)`,
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
        const user = await getQuery(
            `SELECT user_id, title_hash, title_salt FROM users WHERE user_id = ?`,
            [userId]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const candidateHash = hashTitle(title, user.title_salt);
        if (candidateHash !== user.title_hash) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateSessionToken();
        const expiresAtIso = new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString();
        await runQuery(
            `INSERT INTO sessions (session_token, user_id, expires_at) VALUES (?, ?, ?)`,
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
        await runQuery(`DELETE FROM sessions WHERE session_token = ?`, [req.sessionToken]);
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

        const result = await runQuery(
            `INSERT INTO entries (title, content, sentiment_score, user_id) VALUES (?, ?, ?, ?)`,
            [resolvedTitle, content, resolvedSentiment, req.userId]
        );

        res.status(201).json({
            message: 'Entry Saved!',
            data: {
                id: result.id,
                title: resolvedTitle,
                content,
                sentiment_score: resolvedSentiment,
                user_id: req.userId,
            },
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET: Fetch all entries for a user
app.get('/api/entries', requireAuth, async (req, res) => {
    try {
        const data = await allQuery(
            `SELECT * FROM entries WHERE user_id = ? ORDER BY datetime(created_at) DESC`,
            [req.userId]
        );
        res.json(data);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(Number(PORT), () => console.log(`Server active on port ${PORT}`));