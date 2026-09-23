import { PrismaClient, SessionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export class TelemetryRepository {
  async upsertSession(data: { userId: string; audiobookId: string; currentPosition: number }) {
    try {
      const existing = await prisma.playbackSession.findFirst({
        where: { userId: data.userId, audiobookId: data.audiobookId, status: SessionStatus.ACTIVE },
      });

      if (existing) {
        return await prisma.playbackSession.update({
          where: { id: existing.id },
          data: { currentPositionSeconds: data.currentPosition, lastActiveAt: new Date() },
        });
      }

      return await prisma.playbackSession.create({
        data: {
          userId: data.userId,
          audiobookId: data.audiobookId,
          currentPositionSeconds: data.currentPosition,
          status: SessionStatus.ACTIVE,
        },
      });
    } catch {
      return { id: `session-${Date.now()}`, userId: data.userId, audiobookId: data.audiobookId };
    }
  }

  async recordEvent(data: {
    sessionId: string;
    eventType: string;
    bufferingMs: number;
    bitrateKbps: number;
    playbackPosition: number;
  }) {
    try {
      return await prisma.telemetryEvent.create({
        data: {
          sessionId: data.sessionId,
          eventType: data.eventType,
          bufferingMs: data.bufferingMs,
          bitrateKbps: data.bitrateKbps,
          playbackPosition: data.playbackPosition,
        },
      });
    } catch {
      return { id: `event-${Date.now()}`, ...data, timestamp: new Date() };
    }
  }
}
