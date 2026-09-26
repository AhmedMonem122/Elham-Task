/**
 * Vercel serverless entry — serves the SAME Nest app over HTTP.
 * Socket.IO realtime needs a long-lived server (local / VPS / Render…);
 * on Vercel the REST API + Swagger UI work, socket emits are best-effort.
 * See vercel.json (all routes -> this handler) and README.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createApp } from '../src/bootstrap.js';

let handler: ((req: any, res: any) => void) | undefined;

export default async function (req: VercelRequest, res: VercelResponse) {
  if (!handler) {
    const { app } = await createApp();
    await app.init();
    const instance = app.getHttpAdapter().getInstance();
    if (typeof instance !== 'function') {
      throw new Error('HTTP adapter instance is not callable.');
    }
    handler = instance as (req: any, res: any) => void;
  }
  return (handler as (req: any, res: any) => void)(req, res);
}
