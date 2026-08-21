/**
 * ============================================================================
 * Structured Logger — Distributed Job Scheduler
 * ============================================================================
 * Centralized Pino structured logger with high-performance JSON formatting in
 * production and human-readable colorized output in development.
 */

import { pino } from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: process.env.SERVICE_NAME || 'job-scheduler',
  },
});

export type Logger = typeof logger;
