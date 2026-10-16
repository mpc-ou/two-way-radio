import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SignalingGateway } from './signaling.gateway.js';

@Module({
  imports: [RoomsModule, MediaModule],
  providers: [SignalingGateway]
})
export class SignalingModule {}

