import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

function generateBadgeSvg(label, status, color) {
  const leftWidth = 52;
  const rightWidth = Math.max(status.length * 7 + 16, 50);
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${status}">
  <title>${label}: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(leftWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${label}</text>
    <text x="${(leftWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff">${label}</text>
    <text aria-hidden="true" x="${(leftWidth + rightWidth / 2) * 10}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">${status}</text>
    <text x="${(leftWidth + rightWidth / 2) * 10}" y="140" transform="scale(.1)" fill="#fff">${status}</text>
  </g>
</svg>`;
}

router.get('/:serviceId/status.svg', async (req, res) => {
  try {
    const service = await db('services').where({ id: req.params.serviceId }).first();
    let status = 'unknown';
    let color = '#9f9f9f';

    if (!service) {
      status = 'not found';
      color = '#e05d44';
    } else if (!service.enabled) {
      status = 'paused';
      color = '#9f9f9f';
    } else {
      const lastStatus = service.last_status || 'new';
      if (lastStatus === 'success') {
        status = 'passing';
        color = '#3ecf8e';
      } else if (lastStatus === 'failed') {
        status = 'failing';
        color = '#f2637a';
      } else if (lastStatus === 'running') {
        status = 'running';
        color = '#58a6ff';
      } else {
        status = lastStatus;
        color = '#8c95ab';
      }
    }

    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.send(generateBadgeSvg('deploy', status, color));
  } catch (err) {
    res.set('Content-Type', 'image/svg+xml');
    res.send(generateBadgeSvg('deploy', 'error', '#e05d44'));
  }
});

router.get('/:serviceId/status.json', async (req, res) => {
  try {
    const service = await db('services').where({ id: req.params.serviceId }).first();
    if (!service) return res.status(404).json({ error: 'Service not found' });
    res.json({
      schemaVersion: 1,
      label: 'deploy',
      message: service.last_status || 'new',
      color: service.last_status === 'success' ? 'green' : (service.last_status === 'failed' ? 'red' : 'blue'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
