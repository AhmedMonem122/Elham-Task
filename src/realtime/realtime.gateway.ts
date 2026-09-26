import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface SlotBookedPayload {
  slotId: string;
  bookingId: string;
  available: false;
}

export interface SlotReleasedPayload {
  slotId: string;
  bookingId: string;
  available: true;
}

/**
 * Realtime gateway — default namespace `/`, path `/socket.io`.
 * Server-to-client only: the client never needs to emit anything,
 * no auth, no rooms.
 *
 * Events (each sent ONCE, after the DB change is committed):
 * - `slot.booked`   { slotId, bookingId, available: false }
 * - `slot.released` { slotId, bookingId, available: true  }
 *
 * No events for rejected requests or idempotent repeat cancels,
 * and events never carry customer PII.
 */
@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  path: '/socket.io',
})
export class RealtimeGateway implements OnGatewayInit {
  @WebSocketServer()
  private readonly server!: Server;

  afterInit(): void {
    // Intentionally quiet; connection logging would spam serverless logs.
  }

  emitBooked(slotId: string, bookingId: string): void {
    const payload: SlotBookedPayload = { slotId, bookingId, available: false };
    this.server.emit('slot.booked', payload);
  }

  emitReleased(slotId: string, bookingId: string): void {
    const payload: SlotReleasedPayload = {
      slotId,
      bookingId,
      available: true,
    };
    this.server.emit('slot.released', payload);
  }
}
