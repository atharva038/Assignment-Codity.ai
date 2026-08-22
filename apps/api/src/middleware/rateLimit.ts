/**
 * ============================================================================
 * Rate Limiting Middleware — Distributed Job Scheduler
 * ============================================================================
 * Flexible Express middleware that enforces sliding-window rate limits per client.
 * Identifies clients by Authenticated User ID / Tenant or Client IP Address.
 * Standard RFC headers are automatically appended to all HTTP responses.
 */

import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '@job-scheduler/redis';

export interface RateLimiterOptions {
  windowMs?: number; // Window duration in ms (default: 60000ms / 1 min)
  limit?: number; // Maximum allowed requests per window (default: 100)
  keyPrefix?: string; // Prefix for rate limit bucket namespace (default: 'global')
  keyGenerator?: (req: Request) => string; // Custom key generator function
}

/**
 * Creates an Express middleware for rate limiting incoming HTTP requests.
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || 60000;
  const limit = options.limit || 100;
  const keyPrefix = options.keyPrefix || 'global';

  return async (req: Request, res: Response, next: NextFunction) => {
    let clientIdentifier: string;

    if (options.keyGenerator) {
      clientIdentifier = options.keyGenerator(req);
    } else if (req.user?.userId) {
      clientIdentifier = `user:${req.user.userId}`;
    } else {
      const forwarded = req.headers['x-forwarded-for'];
      const rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.ip || req.socket.remoteAddress || '127.0.0.1';
      clientIdentifier = `ip:${rawIp}`;
    }

    const key = `${keyPrefix}:${clientIdentifier}`;

    try {
      const result = await checkRateLimit(key, limit, windowMs);

      // Append standard RFC RateLimit headers
      res.setHeader('X-RateLimit-Limit', result.limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      res.setHeader('X-RateLimit-Reset', result.resetTime.toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter.toString());
        res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${limit} requests allowed per ${Math.ceil(windowMs / 1000)} seconds. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
          resetTime: result.resetTime,
        });
        return;
      }

      next();
    } catch (err) {
      // In case of unexpected error, fail open to avoid service outage
      next();
    }
  };
}
