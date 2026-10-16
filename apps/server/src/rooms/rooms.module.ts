import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';

@Module({
  providers: [RoomsService],
  exports: [RoomsService]
})
export class RoomsModule {}

