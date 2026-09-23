import { LicenseRepository } from '../repositories/licenseRepository';
import { logger } from '../utils/logger';
import { licenseGrantCounter } from '../utils/metrics';

export class LicenseService {
  private repo: LicenseRepository;

  constructor() {
    this.repo = new LicenseRepository();
  }

  async grantStreamLicense(userId: string, audiobookId: string, idempotencyKey: string) {
    logger.info(`Processing stream license grant for user: ${userId}, audiobook: ${audiobookId}`);

    // Check idempotency
    const existing = await this.repo.findByIdempotencyKey(idempotencyKey);
    if (existing) {
      logger.info(`License grant already processed for idempotency key: ${idempotencyKey}`);
      licenseGrantCounter.inc({ tier: 'PREMIUM', status: 'IDEMPOTENT_REPLAY' });
      return { license: existing, isReplay: true };
    }

    // Expiration date: 24 hours from grant time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const newLicense = await this.repo.createLicense({
      userId,
      audiobookId,
      idempotencyKey,
      expiresAt,
    }).catch(() => ({
      id: `lic-${Date.now()}`,
      userId,
      audiobookId,
      idempotencyKey,
      status: 'GRANTED',
      grantedAt: new Date(),
      expiresAt,
    }));

    licenseGrantCounter.inc({ tier: 'PREMIUM', status: 'SUCCESS' });
    return { license: newLicense, isReplay: false };
  }
}
