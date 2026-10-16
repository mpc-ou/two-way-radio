import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [RoomsModule, MediaModule],
  controllers: [HealthController]
})
export class HealthModule {}

