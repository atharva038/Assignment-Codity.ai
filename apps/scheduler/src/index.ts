/**
 * ============================================================================
 * Scheduler Service Orchestrator — Distributed Job Scheduler
 * ============================================================================
 * Runs background loops for:
 * 1. Evaluating recurring cron schedules with multi-replica optimistic locking.
 * 2. Promoting delayed jobs (SCHEDULED -> QUEUED).
 * 3. Reaping stale worker nodes missing heartbeats (>30s).
 * 4. Recovering orphaned job leases from crashed worker processes.
 */

import dotenv from 'dotenv';
import os from 'os';
import { randomUUID } from 'crypto';
import { logger } from '@job-scheduler/logger';
import { evaluateCronSchedules } from './cronEngine.js';
import { promoteDelayedJobs } from './delayedPromoter.js';
import { reapStaleWorkers, recoverOrphanedJobLeases } from './reaper.js';

dotenv.config();

const SCHEDULER_ID = process.env.SCHEDULER_ID || `scheduler-${os.hostname()}-${randomUUID().substring(0, 8)}`;
const CHECK_INTERVAL_MS = parseInt(process.env.SCHEDULER_CHECK_INTERVAL_MS || '5000', 10);
const STALE_WORKER_TIMEOUT_MS = parseInt(process.env.STALE_WORKER_TIMEOUT_MS || '30000', 10);

let isRunning = true;

logger.info({ schedulerId: SCHEDULER_ID, intervalMs: CHECK_INTERVAL_MS }, '📅 Scheduler Service starting up...');

async function runSchedulerLoop() {
  while (isRunning) {
    try {
      // 1. Evaluate recurring cron schedules
      await evaluateCronSchedules(SCHEDULER_ID);

      // 2. Promote delayed jobs (SCHEDULED -> QUEUED)
      await promoteDelayedJobs();

      // 3. Reap stale workers missing heartbeats
      await reapStaleWorkers(STALE_WORKER_TIMEOUT_MS);

      // 4. Recover orphaned job leases from crashed worker processes
      await recoverOrphanedJobLeases();

      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS));
    } catch (err) {
      logger.error({ schedulerId: SCHEDULER_ID, err }, 'Error in scheduler main loop');
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

function gracefulShutdown(signal: string) {
  logger.info({ schedulerId: SCHEDULER_ID, signal }, 'Graceful shutdown initiated for Scheduler Service...');
  isRunning = false;
  setTimeout(() => {
    logger.info('Scheduler Service exited cleanly.');
    process.exit(0);
  }, 500);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

runSchedulerLoop();
