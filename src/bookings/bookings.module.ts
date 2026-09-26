import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [RealtimeModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
