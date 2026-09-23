import { TelemetryRepository } from '../repositories/telemetryRepository';
import { logger } from '../utils/logger';
import { telemetryEventCounter } from '../utils/metrics';

export class TelemetryService {
  private repo: TelemetryRepository;

  constructor() {
    this.repo = new TelemetryRepository();
  }

  async recordTelemetry(data: {
    userId: string;
    audiobookId: string;
    playbackPosition: number;
    eventType: string;
    bufferingMs?: number;
    bitrateKbps?: number;
  }) {
    logger.debug(`Recording telemetry event: ${data.eventType} for session ${data.userId}/${data.audiobookId}`);

    const session = await this.repo.upsertSession({
      userId: data.userId,
      audiobookId: data.audiobookId,
      currentPosition: data.playbackPosition,
    });

    const event = await this.repo.recordEvent({
      sessionId: session.id,
      eventType: data.eventType,
      bufferingMs: data.bufferingMs || 0,
      bitrateKbps: data.bitrateKbps || 256,
      playbackPosition: data.playbackPosition,
    });

    telemetryEventCounter.inc({ event_type: data.eventType });
    return { session, event };
  }
}
