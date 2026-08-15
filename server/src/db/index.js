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
  await db.migrate.latest();
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
