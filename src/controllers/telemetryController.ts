import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { TelemetryService } from '../services/telemetryService';
import { z } from 'zod';

const telemetryService = new TelemetryService();

const TelemetryPayloadSchema = z.object({
  audiobookId: z.string().min(1),
  playbackPosition: z.number().min(0),
  eventType: z.enum(['HEARTBEAT', 'BUFFERING', 'ERROR', 'QUALITY_SHIFT']),
  bufferingMs: z.number().optional(),
  bitrateKbps: z.number().optional(),
});

export const recordTelemetryHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validated = TelemetryPayloadSchema.parse(req.body);
    const userId = req.user?.id || 'usr_demo_123';

    const result = await telemetryService.recordTelemetry({
      userId,
      audiobookId: validated.audiobookId,
      playbackPosition: validated.playbackPosition,
      eventType: validated.eventType,
      bufferingMs: validated.bufferingMs,
      bitrateKbps: validated.bitrateKbps,
    });

    return res.status(200).json({
      status: 'ACCEPTED',
      sessionId: result.session.id,
      recordedAt: new Date(),
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
