import { Controller, Get, Inject } from '@nestjs/common';
import { MediaService } from '../media/media.service.js';
import { RoomsService } from '../rooms/rooms.service.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(MediaService) private readonly media: MediaService,
    @Inject(RoomsService) private readonly rooms: RoomsService
  ) {}

  @Get()
  root(): Record<string, unknown> {
    return {
      name: 'MPC VoiceLink Signaling & Media Relay Server',
      status: 'online',
      message: 'Server đang hoạt động bình thường. Giao diện Web PTT chạy tại cổng 5173 (https://<IP>:5173).',
      healthEndpoint: '/health',
      socketEndpoint: '/socket.io',
      timestamp: new Date().toISOString()
    };
  }

  @Get('health')
  status(): Record<string, unknown> {
    return {
      status: 'ok',
      floorLeaseMs: this.rooms.getFloorLeaseMs(),
      relayProfile: this.media.getRelayProfile(),
      media: this.media.getDiagnostics(),
      recording: false,
      timestamp: new Date().toISOString()
    };
  }
}

