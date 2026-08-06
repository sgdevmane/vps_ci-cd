import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { migrate } from './db/index.js';
import { ensureDefaultAdmin } from './auth/setup.js';
import authRoutes from './routes/auth.js';
import serviceRoutes from './routes/services.js';
import triggerRoutes from './routes/triggers.js';
import settingsRoutes from './routes/settings.js';
import hookRoutes from './routes/hooks.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(cookieParser());

// Webhooks get the raw body so HMAC signatures can be verified.
app.use('/api/hooks', express.raw({ type: '*/*', limit: '5mb' }));
app.use('/api', express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api', hookRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built Svelte UI when present (production mode).
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
} else if (config.env === 'production') {
  console.warn('[warn] web/dist not found — run "npm run build" to build the UI.');
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await migrate();
  const admin = await ensureDefaultAdmin();
  app.listen(config.port, config.host, () => {
    console.log('');
    console.log('  ┌─────────────────────────────────────────────┐');
    console.log('  │  VPS CI/CD — webhook git sync & deploy      │');
    console.log('  └─────────────────────────────────────────────┘');
    console.log(`  Listening on  http://${config.host}:${config.port}`);
    console.log(`  Data dir      ${config.dataDir}`);
    if (admin.created) {
      console.log('');
      console.log(`  First run — login with:  ${admin.username} / ${admin.password}`);
      console.log('  You will be asked to change the password.');
    }
    console.log('');
  });
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
