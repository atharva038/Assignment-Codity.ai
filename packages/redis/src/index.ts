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

redis.on('error', (err) => {
  logger.warn({ err: err.message }, 'Redis connection warning (operating in fallback mode)');
});

export function createRedisClient(): Redis {
  return new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    lazyConnect: true,
  });
}
