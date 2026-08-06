import path from 'node:path';
import { fileURLToPath } from 'node:url';
import knex from 'knex';
import { config } from '../config.js';

// Knex keeps SQL portable: swap client to "pg" + a pg connection object
// when PostgreSQL replaces SQLite.
export const db = knex({
  client: 'better-sqlite3',
  connection: { filename: config.dbFile },
  useNullAsDefault: true,
  migrations: {
    directory: path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations'),
  },
});

export async function migrate() {
  await db.migrate.latest();
}

export async function insertReturning(table, data) {
  const [id] = await db(table).insert(data);
  return id;
}
