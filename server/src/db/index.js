import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knex from 'knex';
import { config } from '../config.js';

const isPostgres = Boolean(config.databaseUrl);

const knexConfig = isPostgres
  ? {
      client: 'pg',
      connection: {
        connectionString: config.databaseUrl,
        ssl: config.pgSsl ? { rejectUnauthorized: false } : false,
      },
      pool: { min: 2, max: 10 },
      migrations: {
        directory: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
      },
    }
  : {
      client: 'better-sqlite3',
      connection: { filename: config.dbFile },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
      },
    };

export const db = knex(knexConfig);

export async function migrate() {
  if (!isPostgres) {
    // Harden SQLite for multi-process deployments (two backend containers
    // sharing one volume): wait instead of erroring on contention and enable
    // WAL so readers never block the writer.
    for (const pragma of ['PRAGMA busy_timeout = 5000', 'PRAGMA journal_mode = WAL', 'PRAGMA foreign_keys = ON']) {
      try {
        await db.raw(pragma);
      } catch {
        /* non-fatal — best effort hardening */
      }
    }
  }
  await db.migrate.latest();
}

/**
 * Remove expired sessions from the database. Called on boot and periodically.
 */
export async function purgeExpiredSessions() {
  try {
    await db('sessions').where('expires_at', '<=', new Date().toISOString()).del();
  } catch {
    /* non-fatal */
  }
}

export async function insertReturning(table, data) {
  if (isPostgres) {
    const res = await db(table).insert(data).returning('id');
    const first = Array.isArray(res) ? res[0] : res;
    return typeof first === 'object' && first !== null ? (first.id ?? first) : first;
  }
  const [id] = await db(table).insert(data);
  return id;
}

export { isPostgres };
