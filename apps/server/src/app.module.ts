import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { SignalingModule } from './signaling/signaling.module.js';

@Module({
  imports: [
    RoomsModule,
    MediaModule,
    SignalingModule,
    HealthModule
  ]
})
export class AppModule {}
