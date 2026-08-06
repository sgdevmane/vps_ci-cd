import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

export const config = {
  env: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT || '3000', 10),
  dataDir: path.resolve(process.env.DATA_DIR || path.join(projectRoot, 'data')),
  sessionDays: parseInt(process.env.SESSION_DAYS || '7', 10),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  defaultAdminUser: process.env.DEFAULT_ADMIN_USER || 'admin',
  defaultAdminPass: process.env.DEFAULT_ADMIN_PASS || 'admin123',
};

fs.mkdirSync(config.dataDir, { recursive: true });
config.dbFile = process.env.DATABASE_FILE || path.join(config.dataDir, 'app.db');
