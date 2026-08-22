/**
 * ============================================================================
 * Distributed & In-Memory Fallback Rate Limiter — Distributed Job Scheduler
 * ============================================================================
 * High-performance sliding-window rate limiter using Redis sorted sets (ZSET).
 * If Redis is disconnected or throws an error, automatically degrades gracefully
 * to an internal thread-safe in-memory sliding window cache.
 */

import { redis } from './index.js';
import { logger } from '@job-scheduler/logger';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds until reset if rate limited
}

// In-Memory Fallback Cache: Map<Key, Array of Timestamps>
const memoryStore = new Map<string, number[]>();

// Periodic memory garbage collector (sweeps expired timestamps every 60s)
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore.entries()) {
    const valid = timestamps.filter(t => t > now - 300000); // 5 min TTL
    if (valid.length === 0) {
      memoryStore.delete(key);
    } else {
      memoryStore.set(key, valid);
    }
  }
}, 60000).unref?.();

/**
 * Checks and increments rate limit counter for a given key and window.
 *
 * @param key Unique key identifier (e.g. `ip:127.0.0.1` or `user:usr_123`)
 * @param limit Maximum allowed hits per window
 * @param windowMs Window duration in milliseconds (default: 60,000ms / 1 min)
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const now = Date.now();
  const redisKey = `ratelimit:${key}`;
  const clearBefore = now - windowMs;
  const resetTime = Math.ceil((now + windowMs) / 1000);

  // Try Redis sliding-window algorithm first
  if (redis.status === 'ready' || redis.status === 'connect') {
    try {
      const member = `${now}-${Math.random().toString(36).substring(2, 7)}`;
      const pipeline = redis.pipeline();

      pipeline.zremrangebyscore(redisKey, 0, clearBefore);
      pipeline.zcard(redisKey);
      pipeline.zadd(redisKey, now, member);
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();
      if (results && results[1] && results[1][1] !== null) {
        const countBeforeAdd = (results[1][1] as number) || 0;
        const currentCount = countBeforeAdd + 1;
        const allowed = currentCount <= limit;
        const remaining = Math.max(0, limit - currentCount);
        const retryAfter = allowed ? 0 : Math.ceil(windowMs / 1000);

        return {
          allowed,
          limit,
          remaining,
          resetTime,
          retryAfter,
        };
      }
    } catch (err: any) {
      logger.warn({ err: err?.message || err, key }, 'Redis rate limit execution failed, falling back to in-memory store');
    }
  }

  // Graceful In-Memory Fallback execution
  const timestamps = (memoryStore.get(key) || []).filter(t => t > clearBefore);
  const currentCount = timestamps.length + 1;
  const allowed = currentCount <= limit;

  if (allowed) {
    timestamps.push(now);
    memoryStore.set(key, timestamps);
  }

  const remaining = Math.max(0, limit - currentCount);
  const retryAfter = allowed ? 0 : Math.ceil(windowMs / 1000);

  return {
    allowed,
    limit,
    remaining,
    resetTime,
    retryAfter,
  };
}

/**
 * Resets/clears the rate limit counter for a specific key (useful for tests or admin unlocks).
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redisKey = `ratelimit:${key}`;
  memoryStore.delete(key);
  try {
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.del(redisKey);
    }
  } catch (err) {
    // Ignore error in reset
  }
}
