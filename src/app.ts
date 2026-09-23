import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { slidingWindowRateLimiter } from './middleware/rateLimiter';
import { enforceIdempotency } from './middleware/idempotency';
import { authenticateToken } from './middleware/auth';
import { grantLicenseHandler } from './controllers/licenseController';
import { recordTelemetryHandler } from './controllers/telemetryController';
import { livenessHandler, readinessHandler, metricsHandler } from './controllers/healthController';
import { httpRequestDuration } from './utils/metrics';

export const app = express();

// Security and CORS middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Prometheus Request Duration Middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});

// Operational Probes & Metrics (Unauthenticated, Unthrottled)
app.get('/health/live', livenessHandler);
app.get('/health/ready', readinessHandler);
app.get('/metrics', metricsHandler);

// Apply Rate Limiter to API routes
app.use('/api/', slidingWindowRateLimiter);

// API Routes
app.post('/api/v1/licenses/grant', authenticateToken, enforceIdempotency, grantLicenseHandler);
app.post('/api/v1/telemetry/playback', authenticateToken, recordTelemetryHandler);

// Fallback 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.method} ${req.path} does not exist.` });
});
