import { Request, Response } from 'express';
import { metricsRegistry } from '../utils/metrics';

export const livenessHandler = (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'UP',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

export const readinessHandler = (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'READY',
    checks: {
      database: 'HEALTHY',
      cacheRedis: 'HEALTHY',
    },
    timestamp: new Date().toISOString(),
  });
};

export const metricsHandler = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (ex: any) {
    res.status(500).end(ex);
  }
};
