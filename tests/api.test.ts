import request from 'supertest';
import { app } from '../src/app';

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
