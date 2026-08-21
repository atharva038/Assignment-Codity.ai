/**
 * ============================================================================
 * Scheduler Service Entrypoint — Distributed Job Scheduler
 * ============================================================================
 * Responsible for:
 * 1. Evaluating recurring cron schedules and triggering job runs when due.
 * 2. Promoting delayed jobs (SCHEDULED -> QUEUED) when scheduledAt <= NOW().
 * 3. Reaping stale/dead workers and recovering orphaned job leases.
 */

import dotenv from 'dotenv';
import { logger } from '@job-scheduler/logger';

dotenv.config();

const CHECK_INTERVAL_MS = parseInt(process.env.SCHEDULER_CHECK_INTERVAL_MS || '5000', 10);
let isRunning = true;

logger.info({ intervalMs: CHECK_INTERVAL_MS }, '📅 Scheduler Service initializing...');

async function runSchedulerLoop() {
  logger.info('Scheduler polling loop active.');
  
  while (isRunning) {
    try {
      // Cron evaluation and stale worker recovery logic will be implemented in Phases 17-19
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
    } catch (err) {
      logger.error({ err }, 'Error in scheduler loop');
    }
  }
}

function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated for Scheduler Service...');
  isRunning = false;
  setTimeout(() => {
    logger.info('Scheduler Service exited cleanly.');
    process.exit(0);
  }, 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

runSchedulerLoop();
