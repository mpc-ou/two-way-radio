import { Controller, Get, Inject } from '@nestjs/common';
import { MediaService } from '../media/media.service.js';
import { RoomsService } from '../rooms/rooms.service.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(RoomsService) private readonly rooms: RoomsService
  ) {}

  @Get('health')
  async status(): Promise<Record<string, unknown>> {
    return {
      status: 'ok',
      floorLeaseMs: this.rooms.getFloorLeaseMs(),
      channels: this.rooms.listChannels().map(({ id, memberCount, speakerName }) => ({
        id,
        memberCount,
        talking: Boolean(speakerName)
      })),
      relayProfile: this.media.getAudioProfile(),
      media: this.media.getDiagnostics(),
      traffic: await this.media.getTrafficStats(),
      recording: false,
      timestamp: new Date().toISOString()
    };
  }
}
