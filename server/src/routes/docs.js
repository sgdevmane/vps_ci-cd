import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiFile = path.resolve(__dirname, '..', 'docs', 'openapi.json');

let swaggerDocument = {};
try {
  swaggerDocument = JSON.parse(fs.readFileSync(openapiFile, 'utf8'));
} catch (err) {
  console.warn('[docs] could not read openapi.json:', err.message);
}

// Serve raw spec JSON
router.get('/swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

router.get('/openapi.json', (req, res) => {
  res.json(swaggerDocument);
});

// Serve interactive Swagger UI
router.use('/', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'VPS CI/CD API Documentation',
  customCss: '.swagger-ui .topbar { display: none } body { background: #0f131a; color: #e2e8f0; }',
}));

export default router;
