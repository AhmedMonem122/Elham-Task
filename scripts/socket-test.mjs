/**
 * Headless Socket.IO check — no UI needed.
 *
 * 1) Terminal A:  npm run start:dev
 * 2) Terminal B:  node scripts/socket-test.mjs
 * 3) Terminal C:  create/cancel bookings, e.g.
 *      curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
 *        -d '{"slotId":"11111111-1111-4111-8111-111111111111","customerName":"Alex Morgan","customerEmail":"alex@example.com"}'
 *    Watch Terminal B print `slot.booked` / `slot.released` with NO customer PII.
 *
 * Env: SOCKET_URL (default http://localhost:3000)
 */
import { io } from 'socket.io-client';

const URL = process.env.SOCKET_URL ?? 'http://localhost:3000';

console.log(`Connecting to ${URL} (path /socket.io, namespace /)…`);
const socket = io(URL, { path: '/socket.io', transports: ['websocket', 'polling'] });

socket.on('connect', () => {
  console.log(`connected: ${socket.id}`);
  console.log('Listening for: slot.booked, slot.released');
  console.log('Now POST /bookings or DELETE /bookings/:id in another terminal.');
});

socket.on('slot.booked', (payload) => {
  console.log('EVENT slot.booked  ', JSON.stringify(payload));
  if ('customerName' in payload || 'customerEmail' in payload) {
    console.error('LEAK: event must not contain customer PII!');
  }
});

socket.on('slot.released', (payload) => {
  console.log('EVENT slot.released', JSON.stringify(payload));
});

socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));
socket.on('connect_error', (err) => console.error(`connect_error: ${err.message}`));

process.on('SIGINT', () => {
  socket.close();
  process.exit(0);
});
