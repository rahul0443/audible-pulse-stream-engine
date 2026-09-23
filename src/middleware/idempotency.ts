import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

// Redis client initialization, same pattern as rateLimiter.ts.
// Exported so tests can force the fallback path deterministically (e.g. by calling
// `.disconnect()`) instead of relying on Redis happening to be unreachable.
export let redis: Redis | null = null;
try {
  redis = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  redis.on('error', (err) => {
    logger.warn(`Redis connection warning (idempotency): ${err.message}. Falling back to in-memory idempotency store.`);
  });

  // See the matching comment in rateLimiter.ts: lazyConnect requires an explicit
  // .connect() call or status never leaves "wait".
  redis.connect().catch(() => {});
} catch (e) {
  logger.warn('Redis client failed to initialize for idempotency, using in-memory store.');
}

interface CachedResponse {
  statusCode: number;
  body: any;
}

// In-memory sliding fallback store, used only when Redis is unreachable
const inMemoryStore = new Map<string, { value: CachedResponse; expiresAt: number }>();

function getFromMemory(key: string): CachedResponse | null {
  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function setInMemory(key: string, value: CachedResponse, ttlSeconds: number) {
  inMemoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Idempotency Key Middleware.
 * Prevents double licensing or double transaction execution by intercepting requests
 * containing `x-idempotency-key` and returning cached responses for repeated calls.
 *
 * Uses an atomic Redis SET ... NX EX as the check-and-set so two concurrent requests
 * for the same key can't both win the race, with an in-memory fallback if Redis is
 * unreachable. Either way this is a fast-path cache in front of the database's
 * `idempotencyKey` unique constraint (see licenseService.ts), which is the actual
 * correctness backstop if both this cache and its fallback miss.
 */
export const enforceIdempotency = async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.header('x-idempotency-key') || req.body?.idempotencyKey;

  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const ttlSeconds = config.idempotencyTtlSeconds;

  try {
    if (redis && redis.status === 'ready') {
      const acquired = await redis.set(cacheKey, JSON.stringify({ status: 'IN_PROGRESS' }), 'EX', ttlSeconds, 'NX');

      if (acquired !== 'OK') {
        const existingRaw = await redis.get(cacheKey);
        if (existingRaw) {
          const existing = JSON.parse(existingRaw);
          if (existing.status !== 'IN_PROGRESS') {
            logger.info(`Idempotent cache hit (Redis) for key: ${idempotencyKey}`);
            return res.status(existing.statusCode).json({ ...existing.body, _idempotentReplay: true });
          }
        }
        // Key exists but is still IN_PROGRESS (a concurrent duplicate arrived mid-flight)
        // or vanished between the SET and GET. Fall through -- the database's unique
        // constraint on idempotencyKey is the correctness backstop either way.
      }

      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis!.set(cacheKey, JSON.stringify({ statusCode: res.statusCode, body }), 'EX', ttlSeconds).catch((err) => {
            logger.warn(`Failed to cache idempotent response in Redis: ${err.message}`);
          });
        }
        return originalJson(body);
      };

      return next();
    }
  } catch (err: any) {
    logger.warn(`Idempotency Redis check failed: ${err.message}. Falling back to in-memory store.`);
  }

  // In-memory fallback (Redis unavailable, uninitialized, or errored above)
  const existing = getFromMemory(cacheKey);
  if (existing) {
    logger.info(`Idempotent cache hit (in-memory fallback) for key: ${idempotencyKey}`);
    return res.status(existing.statusCode).json({ ...existing.body, _idempotentReplay: true });
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      setInMemory(cacheKey, { statusCode: res.statusCode, body }, ttlSeconds);
    }
    return originalJson(body);
  };

  next();
};
