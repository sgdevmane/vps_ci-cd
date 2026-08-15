import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../auth/session.js';
import { addTriggerSubscriber, addGlobalSubscriber } from '../core/sse.js';

const router = Router();
router.use(requireAuth);

router.get('/stream/global', (req, res) => {
  addGlobalSubscriber(res);
});

router.get('/:id/stream', async (req, res, next) => {
  try {
    const trigger = await db('triggers').where({ id: req.params.id }).first();
    if (!trigger) return res.status(404).json({ error: 'Trigger not found' });
    addTriggerSubscriber(req.params.id, res);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '40', 10) || 40, 200);
    const offset = parseInt(req.query.offset || '0', 10) || 0;
    let query = db('triggers')
      .join('services', 'services.id', 'triggers.service_id')
      .select(
        'triggers.*',
        'services.name as service_name',
        'services.provider as service_provider',
      );
    if (req.query.service_id) query = query.where('triggers.service_id', req.query.service_id);
    if (req.query.status) query = query.where('triggers.status', req.query.status);
    const triggers = await query.orderBy('triggers.id', 'desc').limit(limit).offset(offset);
    res.json({ triggers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trigger = await db('triggers')
      .join('services', 'services.id', 'triggers.service_id')
      .where('triggers.id', req.params.id)
      .select(
        'triggers.*',
        'services.name as service_name',
        'services.provider as service_provider',
        'services.folder_path as service_folder',
      )
      .first();
    if (!trigger) return res.status(404).json({ error: 'Trigger not found' });
    res.json({ trigger });
  } catch (err) {
    next(err);
  }
});

export default router;
