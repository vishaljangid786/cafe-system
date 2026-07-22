// Optional Redis cache. Everything here is BEST-EFFORT and fail-open: if
// REDIS_URL is unset, or Redis is unreachable, or a value won't parse, we simply
// compute the fresh result. A cache problem can never break a request.
//
// Uses its own lazy ioredis client (separate from the rate-limit store's) so a
// cache issue is fully isolated from rate limiting.

const Redis = require('ioredis');

let client;
const getRedis = () => {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      keyPrefix: 'cache:',
    });
    client.on('error', (err) => console.error('[cache] Redis error:', err.message));
  }
  return client;
};

const isEnabled = () => !!getRedis();

// Get-or-compute. `compute` runs (and its result is cached for ttlSeconds) only on
// a miss. Any Redis error falls through to computing without caching.
async function cached(key, ttlSeconds, compute) {
  const redis = getRedis();
  if (!redis) return compute();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);
  } catch (err) { /* fall through to compute */ }
  const value = await compute();
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) { /* ignore write errors */ }
  return value;
}

// Delete specific keys (call after a write to bust stale reads).
async function del(...keys) {
  const redis = getRedis();
  if (!redis || !keys.length) return;
  try { await redis.del(...keys); } catch (err) { /* ignore */ }
}

// Delete by pattern (e.g. `analytics:*`). Note keyPrefix is applied automatically.
async function delPattern(pattern) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const stream = redis.scanStream({ match: `cache:${pattern}`, count: 100 });
    const batch = [];
    for await (const keys of stream) {
      // scanStream returns raw keys WITH the prefix; strip it before del (which re-adds it).
      keys.forEach((k) => batch.push(k.replace(/^cache:/, '')));
    }
    if (batch.length) await redis.del(...batch);
  } catch (err) { /* ignore */ }
}

/**
 * Response-cache middleware for GET endpoints. Caches the JSON body of a 2xx
 * response for `ttlSeconds`, keyed by the caller's user id + full URL — so a
 * cached entry is NEVER served to a different user (no cross-tenant leak).
 *
 * Mount AFTER auth so req.user is populated:
 *   router.get('/cash-flow', verifyToken, cacheGet(60), getCashFlow)
 */
const cacheGet = (ttlSeconds = 60) => async (req, res, next) => {
  const redis = getRedis();
  if (!redis || req.method !== 'GET') return next();

  const key = `resp:${req.user?._id || 'anon'}:${req.originalUrl}`;
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      res.set('X-Cache', 'HIT');
      return res.json(JSON.parse(hit));
    }
  } catch (err) { /* ignore and continue to handler */ }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      redis.set(key, JSON.stringify(body), 'EX', ttlSeconds).catch(() => {});
    }
    res.set('X-Cache', 'MISS');
    return originalJson(body);
  };
  next();
};

module.exports = { getRedis, isEnabled, cached, del, delPattern, cacheGet };
