import crypto from 'crypto';
import { getQuery, runQuery } from './db';

export function hashTitle(title, salt) {
  return crypto.scryptSync(title, salt, 64).toString('hex');
}

export function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function parseBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token.trim();
}

export async function validateSession(token) {
  try {
    const session = await getQuery(
      'SELECT session_token, user_id, expires_at FROM sessions WHERE session_token = $1',
      [token]
    );

    if (!session) {
      return { valid: false, error: 'Invalid session token' };
    }

    const now = Date.now();
    const expiresAt = new Date(session.expires_at).getTime();
    
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      await runQuery('DELETE FROM sessions WHERE session_token = $1', [token]);
      return { valid: false, error: 'Session expired. Please log in again.' };
    }

    return { valid: true, userId: session.user_id, sessionToken: token };
  } catch (error) {
    return { valid: false, error: 'Authentication failed' };
  }
}
