import { serve } from '@hono/node-server';
import app from './src/index.js';

// Load env vars from .env
// TODO

const server = serve(app);

// graceful shutdown
process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});