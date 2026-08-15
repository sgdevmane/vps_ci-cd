import { Router } from 'express';
import { db, insertReturning } from '../db/index.js';
import { requireAuth } from '../auth/session.js';
import { nowIso } from '../util/misc.js';
import { sendToChannel } from '../core/notifications.js';

const router = Router();
router.use(requireAuth);

router.get('/channels', async (req, res, next) => {
  try {
    const channels = await db('notification_channels').orderBy('id', 'asc');
    res.json({ channels });
  } catch (err) {
    next(err);
  }
});

router.post('/channels', async (req, res, next) => {
  try {
    const { name, provider, webhook_url, config, enabled } = req.body || {};
    if (!name || !provider) {
      return res.status(400).json({ error: 'Name and provider are required' });
    }
    const id = await insertReturning('notification_channels', {
      name: String(name).trim(),
      provider: String(provider).trim(),
      webhook_url: String(webhook_url || '').trim() || null,
      config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null,
      enabled: enabled === undefined ? 1 : !!enabled,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    const channel = await db('notification_channels').where({ id }).first();
    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
});

router.put('/channels/:id', async (req, res, next) => {
  try {
    const existing = await db('notification_channels').where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ error: 'Channel not found' });
    const { name, provider, webhook_url, config, enabled } = req.body || {};
    const updates = {
      updated_at: nowIso(),
    };
    if (name !== undefined) updates.name = String(name).trim();
    if (provider !== undefined) updates.provider = String(provider).trim();
    if (webhook_url !== undefined) updates.webhook_url = String(webhook_url).trim() || null;
    if (config !== undefined) {
      updates.config = config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null;
    }
    if (enabled !== undefined) updates.enabled = !!enabled;

    await db('notification_channels').where({ id: existing.id }).update(updates);
    const channel = await db('notification_channels').where({ id: existing.id }).first();
    res.json({ channel });
  } catch (err) {
    next(err);
  }
});

router.delete('/channels/:id', async (req, res, next) => {
  try {
    const deleted = await db('notification_channels').where({ id: req.params.id }).del();
    if (!deleted) return res.status(404).json({ error: 'Channel not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/channels/:id/test', async (req, res, next) => {
  try {
    const channel = await db('notification_channels').where({ id: req.params.id }).first();
    if (!channel) return res.status(404).json({ error: 'Channel not found' });

    await sendToChannel(channel, 'success', {
      serviceName: 'Test Notification Service',
      branch: 'main',
      sha: 'a1b2c3d4e5f6',
      durationMs: 1540,
    });
    res.json({ ok: true, message: 'Test notification dispatched' });
  } catch (err) {
    next(err);
  }
});

export default router;
