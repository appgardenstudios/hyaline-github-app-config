import dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import SmeeClient from 'smee-client';
import app from './src/index.js';

// Load env vars from .env
dotenv.config();

// Start the local server
const server = serve(app);

// Connect the smee client
const smee = new SmeeClient({
  source: process.env.SMEE_WEBHOOK_URL || '',
  target: 'http://localhost:3000/webhooks',
  logger: console
});
const events = await smee.start()

// Shutdown gracefully
process.on('SIGINT', () => {
  events.close();
  server.close();
  process.exit(0);
});
process.on('SIGTERM', () => {
  events.close();
  server.close((err) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    process.exit(0);
  });
});