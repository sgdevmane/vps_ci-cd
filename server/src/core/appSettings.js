import { db } from '../db/index.js';

export async function getSetting(key) {
  const row = await db('settings').where({ key }).first();
  return row?.value ?? null;
}

export async function putSetting(key, value) {
  const existing = await db('settings').where({ key }).first();
  if (existing) await db('settings').where({ key }).update({ value });
  else await db('settings').insert({ key, value });
}

export function baseUrlFor(req, stored) {
  return (stored || `http://${req.headers.host}`).replace(/\/+$/, '');
}
