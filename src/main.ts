import 'dotenv/config';
import { createApp } from './bootstrap.js';

async function main() {
  const { app } = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(
    `Booking API up on :${port} — docs at /docs, spec at /openapi.json`,
  );
}

void main();
