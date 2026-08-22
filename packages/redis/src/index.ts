/**
 * ============================================================================
 * Redis Client & PubSub Wrapper — Distributed Job Scheduler
 * ============================================================================
 * Exports ioredis client instances for caching and PubSub event broadcasting.
 */

import { Redis } from 'ioredis';
import { logger } from '@job-scheduler/logger';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  logger.info({ host: REDIS_HOST, port: REDIS_PORT }, 'Connected to Redis Cache & PubSub');
});

redis.on('error', (err: any) => {
  logger.warn({ err: err?.message || err }, 'Redis connection warning (operating in fallback mode)');
});


export const REDIS_JOB_EVENTS_CHANNEL = 'job-events';

export async function publishJobEvent(event: any): Promise<void> {
  try {
    await redis.publish(REDIS_JOB_EVENTS_CHANNEL, JSON.stringify(event));
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to publish job event to Redis pub/sub channel');
  }
}

export function createRedisClient(): Redis {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    lazyConnect: true,
  });
}
export * from './rateLimiter.js';
