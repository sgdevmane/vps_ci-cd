import client from 'prom-client';

// Initialize registry
export const register = new client.Registry();

// Enable collection of default Node.js / process metrics
client.collectDefaultMetrics({
  register,
  prefix: 'vps_node_',
});

// Custom HTTP Metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Custom CI/CD Domain Metrics
export const triggersTotal = new client.Counter({
  name: 'vps_triggers_total',
  help: 'Total deployment triggers initiated',
  labelNames: ['source', 'status', 'provider'],
  registers: [register],
});

export const syncDuration = new client.Histogram({
  name: 'vps_sync_duration_seconds',
  help: 'Duration of git sync and command execution in seconds',
  labelNames: ['service_id', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const activeSyncs = new client.Gauge({
  name: 'vps_active_syncs',
  help: 'Number of currently executing git sync runs',
  labelNames: ['service_id'],
  registers: [register],
});

export const webhooksReceivedTotal = new client.Counter({
  name: 'vps_webhooks_received_total',
  help: 'Total webhooks received from git providers',
  labelNames: ['provider', 'verified', 'status'],
  registers: [register],
});

/**
 * Express middleware to record HTTP metrics
 */
export function metricsMiddleware(req, res, next) {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.baseUrl ? `${req.baseUrl}${req.route?.path || req.path}` : (req.route?.path || req.path);
    const normalizedRoute = route.replace(/\/[a-zA-Z0-9_-]{16,64}/g, '/:token').replace(/\/\d+/g, '/:id');
    const labels = {
      method: req.method,
      route: normalizedRoute,
      status_code: res.statusCode,
    };
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
  });
  next();
}
