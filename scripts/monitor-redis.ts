/**
 * ============================================================================
 * Live Redis Pub/Sub Event Monitor — Distributed Job Scheduler
 * ============================================================================
 * Subscribes to Redis channel `job-events` and prints beautifully formatted,
 * color-coded JSON event objects in real time.
 */

import dotenv from 'dotenv';
dotenv.config();

import { createRedisClient, REDIS_JOB_EVENTS_CHANNEL } from '../packages/redis/src/index.js';

async function startMonitor() {
  console.log(`\x1b[36m========================================================\x1b[0m`);
  console.log(`\x1b[32m📡 Live Redis Event Monitor Subscribed to: \x1b[1m${REDIS_JOB_EVENTS_CHANNEL}\x1b[0m`);
  console.log(`\x1b[36m========================================================\x1b[0m\n`);

  const subscriber = createRedisClient();

  subscriber.on('message', (channel, message) => {
    if (channel === REDIS_JOB_EVENTS_CHANNEL) {
      try {
        const event = JSON.parse(message);
        const timestamp = new Date(event.ts || Date.now()).toLocaleTimeString();

        console.log(`\n\x1b[33m[${timestamp}]\x1b[0m ⚡ \x1b[1m\x1b[35m${event.type}\x1b[0m`);
        console.dir(event.payload, { depth: 3, colors: true });
      } catch {
        console.log(message);
      }
    }
  });

  try {
    await subscriber.connect();
    await subscriber.subscribe(REDIS_JOB_EVENTS_CHANNEL);
  } catch (err: any) {
    console.error('Failed to connect to Redis monitor:', err.message);
    process.exit(1);
  }
}

startMonitor();
