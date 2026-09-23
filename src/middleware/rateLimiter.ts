import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { rateLimitBlockCounter } from '../utils/metrics';

// Redis Client initialization with reconnection strategy
let redis: Redis | null = null;
try {
  redis = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
  });

  redis.on('error', (err) => {
    logger.warn(`Redis connection warning: ${err.message}. Falling back to in-memory rate limiter.`);
  });

  // `lazyConnect: true` means the client stays in status "wait" -- never "ready" --
  // until something actually calls .connect(). Since the request path below only
  // issues Redis commands when status is already "ready", nothing would ever
  // trigger that first connection: kick it off here instead. Errors are handled by
  // the 'error' listener above; this is intentionally not awaited.
  redis.connect().catch(() => {});
} catch (e) {
  logger.warn('Redis client failed to initialize, using in-memory rate limiter.');
}

// In-memory sliding window fallback store
const inMemoryStore = new Map<string, number[]>();

/**
 * Distributed Sliding Window Rate Limiter Middleware.
 * Uses Redis Sorted Sets (ZADD, ZREMRANGEBYSCORE, ZCARD) for atomic sliding window evaluation.
 */
export const slidingWindowRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const key = `ratelimit:${clientIp}`;
  const now = Date.now();
  const windowMs = config.rateLimitWindowSeconds * 1000;
  const maxRequests = config.rateLimitMaxRequests;
  const windowStart = now - windowMs;

  try {
    if (redis && redis.status === 'ready') {
      // Atomic Lua script or pipeline for Redis Sliding Window
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, now, `${now}-${Math.random()}`);
      pipeline.zcard(key);
      pipeline.expire(key, config.rateLimitWindowSeconds);

      const results = await pipeline.exec();
      const requestCount = (results?.[2]?.[1] as number) || 1;

      if (requestCount > maxRequests) {
        rateLimitBlockCounter.inc({ client_ip: clientIp });
        logger.warn(`Rate limit exceeded for IP: ${clientIp} (${requestCount}/${maxRequests})`);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit of ${maxRequests} requests per ${config.rateLimitWindowSeconds}s exceeded.`,
          retryAfterSeconds: config.rateLimitWindowSeconds,
        });
      }
    } else {
      // In-memory fallback sliding window
      let timestamps = inMemoryStore.get(key) || [];
      timestamps = timestamps.filter((t) => t > windowStart);
      timestamps.push(now);
      inMemoryStore.set(key, timestamps);

      if (timestamps.length > maxRequests) {
        rateLimitBlockCounter.inc({ client_ip: clientIp });
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded (in-memory evaluation).',
          retryAfterSeconds: config.rateLimitWindowSeconds,
        });
      }
    }

    next();
  } catch (err: any) {
    logger.error(`Rate limiter execution error: ${err.message}`);
    // Fail open in case of rate limiter infrastructure failure to preserve availability
    next();
  }
};
