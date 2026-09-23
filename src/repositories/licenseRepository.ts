import { PrismaClient, LicenseStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class LicenseRepository {
  /**
   * Demo/self-service convenience: `userId` and `audiobookId` arrive as free-text
   * IDs from the client (there's no separate user-registration or catalog-ingest
   * flow in this project), but User/Audiobook are real foreign-key targets. Rather
   * than requiring them to be pre-seeded, auto-provision a minimal row on first use.
   */
  async ensureUser(userId: string) {
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@demo.audible.local`, name: userId },
    });
  }

  async ensureAudiobook(audiobookId: string) {
    await prisma.audiobook.upsert({
      where: { id: audiobookId },
      update: {},
      create: {
        id: audiobookId,
        title: audiobookId,
        author: 'Unknown',
        durationSeconds: 0,
        streamUrl: `https://stream.example.com/${audiobookId}`,
      },
    });
  }

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
