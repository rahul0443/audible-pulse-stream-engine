import client from 'prom-client';

// Enable default metrics collection (CPU, Memory, Event Loop)
client.collectDefaultMetrics({ prefix: 'audible_pulse_' });

export const httpRequestDuration = new client.Histogram({
  name: 'audible_pulse_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const licenseGrantCounter = new client.Counter({
  name: 'audible_pulse_license_grants_total',
  help: 'Total number of audio stream licenses granted',
  labelNames: ['tier', 'status'],
});

export const telemetryEventCounter = new client.Counter({
  name: 'audible_pulse_telemetry_events_total',
  help: 'Total playback telemetry events processed',
  labelNames: ['event_type'],
});

export const rateLimitBlockCounter = new client.Counter({
  name: 'audible_pulse_rate_limit_blocks_total',
  help: 'Total requests blocked by rate limiter',
  labelNames: ['client_ip'],
});

export const metricsRegistry = client.register;
