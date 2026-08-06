import { db } from '../db/index.js';
import { config } from '../config.js';
import { hashSecret } from '../util/crypto.js';
import { nowIso } from '../util/misc.js';

export async function ensureDefaultAdmin() {
  const count = await db('users').count('* as n').first();
  if (count?.n > 0) return { created: false };
  await db('users').insert({
    username: config.defaultAdminUser,
    password_hash: hashSecret(config.defaultAdminPass),
    must_change_password: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  });
  return { created: true, username: config.defaultAdminUser, password: config.defaultAdminPass };
}
