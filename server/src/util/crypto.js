import crypto from 'node:crypto';

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

export function hashSecret(secret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, KEY_LEN, SCRYPT_OPTS).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifySecret(secret, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  try {
    const test = crypto.scryptSync(secret, salt, Buffer.byteLength(hash) / 2, SCRYPT_OPTS);
    return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

export function normalizeAnswer(answer) {
  return String(answer || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function newToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}
