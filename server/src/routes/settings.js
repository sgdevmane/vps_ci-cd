import { Router } from 'express';
import { requireAuth } from '../auth/session.js';
import { getSetting, putSetting, baseUrlFor } from '../core/appSettings.js';
import { auditLog } from '../core/audit.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const stored = await getSetting('public_base_url');
    res.json({
      publicBaseUrl: stored || '',
      effectiveBaseUrl: baseUrlFor(req, stored),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const { publicBaseUrl } = req.body || {};
    if (publicBaseUrl && !/^https?:\/\//.test(String(publicBaseUrl))) {
      return res.status(400).json({ error: 'Public base URL must start with http:// or https://' });
    }
    await putSetting('public_base_url', String(publicBaseUrl || '').trim());
    const stored = await getSetting('public_base_url');
    auditLog({ userId: req.user.id, action: 'settings.updated', targetType: 'setting', targetId: 'public_base_url', details: { value: stored || '' }, ip: req.ip });
    res.json({ publicBaseUrl: stored || '', effectiveBaseUrl: baseUrlFor(req, stored) });
  } catch (err) {
    next(err);
  }
});

export default router;
