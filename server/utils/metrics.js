// Lightweight Prometheus metrics: default process stats + per-request duration
// and counts. Exposed at GET /metrics, guarded by a bearer token so it is never
// public. Off by default — if no METRICS_TOKEN (or CRON_SECRET) is set the
// endpoint returns 404 and the middleware still records harmlessly in-process.
//
// Serverless note: on Vercel each function instance keeps its OWN counters and is
// short-lived, so /metrics is a per-instance snapshot. For fleet-wide aggregation
// point a push-gateway or a hosted APM at it; for a single long-running server it
// is complete.

const client = require('prom-client');

const register = new client.Registry();
register.setDefaultLabels({ app: 'cafeos-api' });
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// The matched route PATTERN (e.g. /api/customers/:id), not the concrete URL —
// otherwise every id would be its own label and blow up cardinality.
const routeOf = (req) => {
  const base = req.baseUrl || '';
  const path = req.route?.path || '';
  const full = `${base}${path}`;
  return full || (req.path && req.path.startsWith('/api') ? 'unmatched_api' : 'other');
};

const metricsMiddleware = (req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const labels = { method: req.method, route: routeOf(req), status_code: res.statusCode };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
};

// GET /metrics — bearer-token guarded. Returns 404 when no token is configured so
// the endpoint doesn't exist for anyone by default.
const metricsHandler = async (req, res) => {
  const token = process.env.METRICS_TOKEN || process.env.CRON_SECRET;
  if (!token) return res.status(404).end();
  const auth = req.headers?.authorization || '';
  const provided = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (provided !== token) return res.status(401).end();

  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};

module.exports = { register, metricsMiddleware, metricsHandler };
