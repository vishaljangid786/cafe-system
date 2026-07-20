const Redis = require('ioredis');

let redis;

const getRedis = () => {
  if (!process.env.REDIS_URL) return null;
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      console.error('[rate-limit] Redis error:', err.message);
    });
  }
  return redis;
};

// Atomic increment-and-expire. Doing INCR then PEXPIRE as two calls leaves a
// window where a crash/Redis error between them orphans the key with no TTL,
// permanently rate-limiting that IP. This Lua script runs atomically inside
// Redis and is self-healing: any key found without a TTL (the first hit, or a
// previously orphaned one) is given a fresh window.
const INCR_EXPIRE_LUA = `
local hits = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {hits, ttl}
`;

const createRedisRateLimitStore = (prefix = 'rl') => {
  const client = getRedis();
  if (!client) return undefined;

  let windowMs = 60 * 1000;
  const keyFor = (key) => `${prefix}:${key}`;

  return {
    localKeys: false,
    init(options) {
      windowMs = options.windowMs;
    },
    async increment(key) {
      const redisKey = keyFor(key);
      const [totalHits, ttl] = await client.eval(INCR_EXPIRE_LUA, 1, redisKey, windowMs);
      return {
        totalHits,
        resetTime: new Date(Date.now() + Math.max(ttl, 0)),
      };
    },
    async decrement(key) {
      const redisKey = keyFor(key);
      const count = await client.decr(redisKey);
      if (count <= 0) await client.del(redisKey);
    },
    async resetKey(key) {
      await client.del(keyFor(key));
    },
  };
};

const withRateLimitStore = (options, prefix) => {
  const store = createRedisRateLimitStore(prefix);
  return store ? { ...options, store } : options;
};

module.exports = {
  createRedisRateLimitStore,
  withRateLimitStore,
};
