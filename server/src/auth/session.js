import { db } from '../db/index.js';
import { config } from '../config.js';
import { newToken } from '../util/crypto.js';
import { nowIso } from '../util/misc.js';

export const SESSION_COOKIE = 'vcid_session';

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  };
}

export async function createSession(res, userId) {
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + config.sessionDays * 864e5).toISOString();
  await db('sessions').insert({
    token,
    user_id: userId,
    created_at: nowIso(),
    expires_at: expiresAt,
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  return token;
}

export async function destroySession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await db('sessions').where({ token }).del();
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function destroyAllSessions(userId) {
  await db('sessions').where({ user_id: userId }).del();
}

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[SESSION_COOKIE];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const row = await db('sessions')
      .join('users', 'users.id', 'sessions.user_id')
      .where({ 'sessions.token': token })
      .where('sessions.expires_at', '>', nowIso())
      .select(
        'users.id',
        'users.username',
        'users.must_change_password',
        'users.security_question',
      )
      .first();
    if (!row) {
      res.clearCookie(SESSION_COOKIE, cookieOptions());
      return res.status(401).json({ error: 'Session expired' });
    }
    req.user = {
      id: row.id,
      username: row.username,
      mustChangePassword: !!row.must_change_password,
      hasSecurityQuestion: !!row.security_question,
    };
    next();
  } catch (err) {
    next(err);
  }
}
