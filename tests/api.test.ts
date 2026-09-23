import request from 'supertest';
import { app } from '../src/app';
import { config } from '../src/config';
import { logger } from '../src/utils/logger';
import { redis as idempotencyRedis } from '../src/middleware/idempotency';

describe('Audible Pulse Stream Engine API Integration Tests', () => {
  describe('GET /health/live', () => {
    it('should return 200 OK with status UP', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('uptimeSeconds');
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 OK with readiness checks', async () => {
      const res = await request(app).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('READY');
      expect(res.body.checks.database).toBe('HEALTHY');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics text format', async () => {
      const res = await request(app).get('/metrics');
      expect(res.status).toBe(200);
      expect(res.text).toContain('audible_pulse_');
    });
  });

  describe('POST /api/v1/licenses/grant', () => {
    it('should grant stream license with valid payload', async () => {
      const res = await request(app)
        .post('/api/v1/licenses/grant')
        .set('x-user-id', 'usr_test_99')
        .set('x-idempotency-key', 'idem_key_99998888')
        .send({
          audiobookId: 'ab_test_101',
          idempotencyKey: 'idem_key_99998888',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('granted');
      expect(res.body.license).toBeDefined();
    });

    it('should handle idempotency replay for duplicate requests', async () => {
      const payload = {
        audiobookId: 'ab_test_101',
        idempotencyKey: 'idem_key_unique_777',
      };

      const first = await request(app)
        .post('/api/v1/licenses/grant')
        .set('x-user-id', 'usr_test_99')
        .set('x-idempotency-key', 'idem_key_unique_777')
        .send(payload);

      expect(first.status).toBe(201);

      const second = await request(app)
        .post('/api/v1/licenses/grant')
        .set('x-user-id', 'usr_test_99')
        .set('x-idempotency-key', 'idem_key_unique_777')
        .send(payload);

      expect(second.status).toBe(201);
      expect(second.body._idempotentReplay).toBe(true);
    });

    it('should reject invalid payload with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/v1/licenses/grant')
        .set('x-user-id', 'usr_test_99')
        .send({ audiobookId: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });

    it('should treat a request as new once the idempotency TTL has expired', async () => {
      const originalTtl = config.idempotencyTtlSeconds;
      config.idempotencyTtlSeconds = 1;

      try {
        const payload = {
          audiobookId: 'ab_test_101',
          idempotencyKey: 'idem_key_ttl_expiry_test',
        };

        const first = await request(app)
          .post('/api/v1/licenses/grant')
          .set('x-user-id', 'usr_test_99')
          .set('x-idempotency-key', payload.idempotencyKey)
          .send(payload);
        expect(first.status).toBe(201);
        expect(first.body._idempotentReplay).toBeUndefined();

        // Wait past the 1s TTL so the fast-path cache entry expires.
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const second = await request(app)
          .post('/api/v1/licenses/grant')
          .set('x-user-id', 'usr_test_99')
          .set('x-idempotency-key', payload.idempotencyKey)
          .send(payload);

        // The fast-path cache (Redis or in-memory) has expired, so this does NOT come
        // back as `_idempotentReplay`. But the database's unique constraint on
        // idempotencyKey is still there as a backstop, so the license service itself
        // still recognizes it as a duplicate and reports `isReplay: true`.
        expect(second.status).toBe(201);
        expect(second.body._idempotentReplay).toBeUndefined();
        expect(second.body.isReplay).toBe(true);
      } finally {
        config.idempotencyTtlSeconds = originalTtl;
      }
    });

    it('should fall back to the in-memory idempotency store when Redis is unavailable', async () => {
      // Force the fallback path deterministically -- don't rely on Redis happening
      // to be unreachable in whatever environment this runs in.
      idempotencyRedis?.disconnect();
      // Give ioredis a tick to actually transition status away from "ready".
      await new Promise((resolve) => setTimeout(resolve, 20));

      const infoSpy = jest.spyOn(logger, 'info');

      try {
        const payload = {
          audiobookId: 'ab_test_101',
          idempotencyKey: 'idem_key_fallback_test',
        };

        await request(app)
          .post('/api/v1/licenses/grant')
          .set('x-user-id', 'usr_test_99')
          .set('x-idempotency-key', payload.idempotencyKey)
          .send(payload);

        const replay = await request(app)
          .post('/api/v1/licenses/grant')
          .set('x-user-id', 'usr_test_99')
          .set('x-idempotency-key', payload.idempotencyKey)
          .send(payload);

        expect(replay.status).toBe(201);
        expect(replay.body._idempotentReplay).toBe(true);
        expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('in-memory fallback'));
      } finally {
        infoSpy.mockRestore();
        idempotencyRedis?.connect().catch(() => {});
      }
    });
  });

  describe('POST /api/v1/telemetry/playback', () => {
    it('should accept valid telemetry event payload', async () => {
      const res = await request(app)
        .post('/api/v1/telemetry/playback')
        .set('x-user-id', 'usr_test_99')
        .send({
          audiobookId: 'ab_test_101',
          playbackPosition: 120,
          eventType: 'HEARTBEAT',
          bufferingMs: 15,
          bitrateKbps: 256,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACCEPTED');
      expect(res.body.sessionId).toBeDefined();
    });
  });
});
