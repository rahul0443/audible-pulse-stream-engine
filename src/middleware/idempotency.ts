import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// In-memory idempotency cache for fallback/testing
const idempotencyStore = new Map<string, { statusCode: number; body: any; timestamp: number }>();

/**
 * Idempotency Key Middleware.
 * Prevents double licensing or double transaction execution by intercepting requests
 * containing `x-idempotency-key` and returning cached responses for repeated calls.
 */
export const enforceIdempotency = (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.header('x-idempotency-key') || req.body?.idempotencyKey;

  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `idempotency:${idempotencyKey}`;
  const existing = idempotencyStore.get(cacheKey);

  if (existing) {
    logger.info(`Idempotent cache hit for key: ${idempotencyKey}`);
    return res.status(existing.statusCode).json({
      ...existing.body,
      _idempotentReplay: true,
    });
  }

  // Intercept response to cache result
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cacheKey, {
        statusCode: res.statusCode,
        body,
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
};
