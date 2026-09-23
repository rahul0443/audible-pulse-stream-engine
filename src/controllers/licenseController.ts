import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { LicenseService } from '../services/licenseService';
import { z } from 'zod';

const licenseService = new LicenseService();

const GrantLicenseSchema = z.object({
  audiobookId: z.string().min(1, 'Audiobook ID is required'),
  idempotencyKey: z.string().min(8, 'Idempotency key must be at least 8 chars'),
});

export const grantLicenseHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = GrantLicenseSchema.parse(req.body);
    const userId = req.user?.id || 'usr_demo_123';

    const result = await licenseService.grantStreamLicense(
      userId,
      validated.audiobookId,
      validated.idempotencyKey
    );

    return res.status(201).json({
      message: 'Stream license successfully granted',
      license: result.license,
      isReplay: result.isReplay,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
