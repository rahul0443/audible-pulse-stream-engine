import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/audible_pulse',
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  jwtSecret: process.env.JWT_SECRET || 'audible-pulse-secret-key-change-in-prod',
  rateLimitWindowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '60', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQ || '100', 10),
};
