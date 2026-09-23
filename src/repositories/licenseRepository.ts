import { PrismaClient, LicenseStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class LicenseRepository {
  async findByIdempotencyKey(idempotencyKey: string) {
    try {
      return await prisma.licenseGrant.findUnique({
        where: { idempotencyKey },
        include: { user: true, audiobook: true },
      });
    } catch {
      return null;
    }
  }

  async findActiveLicense(userId: string, audiobookId: string) {
    try {
      return await prisma.licenseGrant.findFirst({
        where: {
          userId,
          audiobookId,
          status: LicenseStatus.GRANTED,
          expiresAt: { gt: new Date() },
        },
      });
    } catch {
      return null;
    }
  }

  async createLicense(data: {
    userId: string;
    audiobookId: string;
    idempotencyKey: string;
    expiresAt: Date;
  }) {
    return await prisma.licenseGrant.create({
      data: {
        userId: data.userId,
        audiobookId: data.audiobookId,
        idempotencyKey: data.idempotencyKey,
        expiresAt: data.expiresAt,
        status: LicenseStatus.GRANTED,
      },
    });
  }
}
