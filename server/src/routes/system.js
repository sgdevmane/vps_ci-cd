import { Router } from 'express';
import { db, insertReturning } from '../db/index.js';
import { requireAuth } from '../auth/session.js';
import { getSystemHealth } from '../core/systemInfo.js';
import { nowIso } from '../util/misc.js';
import { auditLog } from '../core/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/health', (req, res) => {
  try {
    const health = getSystemHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Security audit trail (latest first, bounded)
router.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 500);
    const logs = await db('audit_logs')
      .orderBy('id', 'desc')
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

router.get('/backup/export', async (req, res, next) => {
  try {
    const [services, commands, channels, serviceNotifications, serviceEnv, settings] = await Promise.all([
      db('services').select('*'),
      db('commands').select('*'),
      db('notification_channels').select('*'),
      db('service_notifications').select('*'),
      db('service_env').select('*'),
      db('settings').select('*'),
    ]);

    const backup = {
      version: '1.0.0',
      exported_at: nowIso(),
      services,
      commands,
      channels,
      serviceNotifications,
      serviceEnv,
      settings,
    };

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="vps-cicd-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    });
    auditLog({ userId: req.user.id, action: 'backup.exported', details: { services: services.length, channels: channels.length }, ip: req.ip });
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

router.post('/backup/import', async (req, res, next) => {
  try {
    const data = req.body;
    if (!data || !Array.isArray(data.services)) {
      return res.status(400).json({ error: 'Invalid backup file structure' });
    }

    // Insert imported services
    for (const s of data.services) {
      const existing = await db('services').where({ hook_token: s.hook_token }).first();
      let serviceId;
      const { id, ...serviceData } = s;
      if (existing) {
        await db('services').where({ id: existing.id }).update({ ...serviceData, updated_at: nowIso() });
        serviceId = existing.id;
      } else {
        serviceId = await insertReturning('services', { ...serviceData, created_at: nowIso(), updated_at: nowIso() });
      }

      // Restore commands for this service if available
      if (Array.isArray(data.commands)) {
        const serviceCommands = data.commands.filter((c) => c.service_id === id);
        if (serviceCommands.length) {
          await db('commands').where({ service_id: serviceId }).del();
          await db('commands').insert(
            serviceCommands.map((c) => ({
              service_id: serviceId,
              position: c.position || 0,
              command: c.command,
              branch_filter: c.branch_filter || null,
              continue_on_error: !!c.continue_on_error,
            }))
          );
        }
      }
    }

    // Restore notification channels & settings if present in the snapshot
    if (Array.isArray(data.channels) && data.channels.length) {
      for (const ch of data.channels) {
        const existing = await db('notification_channels').where({ name: ch.name }).first();
        const channelData = { ...ch };
        delete channelData.id;
        delete channelData.created_at;
        if (existing) {
          await db('notification_channels').where({ id: existing.id }).update({ ...channelData, updated_at: nowIso() });
        } else {
          await insertReturning('notification_channels', { ...channelData, created_at: nowIso(), updated_at: nowIso() });
        }
      }
    }
    if (Array.isArray(data.settings)) {
      for (const s of data.settings) {
        if (s?.key) await db('settings').insert({ key: s.key, value: s.value }).onConflict('key').ignore();
      }
    }

    auditLog({ userId: req.user.id, action: 'backup.imported', details: { services: data.services.length, channels: Array.isArray(data.channels) ? data.channels.length : 0 }, ip: req.ip });
    res.json({ ok: true, message: `Successfully imported ${data.services.length} services` });
  } catch (err) {
    next(err);
  }
});

export default router;
