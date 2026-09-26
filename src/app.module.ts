import { Module } from '@nestjs/common';
import { BookingsModule } from './bookings/bookings.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SlotsModule } from './slots/slots.module.js';

@Module({
  imports: [PrismaModule, RealtimeModule, SlotsModule, BookingsModule],
  controllers: [HealthController],
})
export class AppModule {}
