/**
 * ============================================================================
 * Worker Process Orchestrator — Distributed Job Scheduler
 * ============================================================================
 * Coordinates worker node registration, heartbeat telemetry, polling claim engine
 * using PostgreSQL `FOR UPDATE SKIP LOCKED`, concurrent job execution, and graceful
 * shutdown signal handling.
 */

import dotenv from 'dotenv';
import os from 'os';
import { randomUUID } from 'crypto';
import { prisma, JobStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';
import { WorkerHeartbeatManager } from './heartbeat.js';
import { claimJobs } from './claim.js';
import { executeJob } from './executor.js';

dotenv.config();

const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${randomUUID().substring(0, 8)}`;
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '1000', 10);
// Optional Queue Sharding: bind this worker process to a dedicated Queue Shard
const TARGET_QUEUE_ID = process.env.WORKER_QUEUE_ID || process.env.QUEUE_ID || undefined;

let isRunning = true;
let activeCount = 0;

const heartbeatManager = new WorkerHeartbeatManager(WORKER_ID, CONCURRENCY);

/**
 * Worker main startup routine
 */
async function startWorker() {
  logger.info(
    {
      workerId: WORKER_ID,
      concurrency: CONCURRENCY,
      mode: TARGET_QUEUE_ID ? 'SHARDED_DEDICATED' : 'GLOBAL_MULTI_QUEUE',
      targetQueueId: TARGET_QUEUE_ID || 'ALL',
    },
    TARGET_QUEUE_ID
      ? `🚀 Worker starting in SHARDED mode (Dedicated to Queue: ${TARGET_QUEUE_ID})`
      : '🚀 Worker starting in GLOBAL mode (Polling all active queues)'
  );

  // 1. Register worker in database fleet
  await heartbeatManager.register();
  heartbeatManager.startHeartbeatLoop(5000);

  // 2. Start continuous polling claim loop
  runPollingLoop();
}

/**
 * Main continuous polling and execution loop
 */
async function runPollingLoop() {
  while (isRunning) {
    try {
      // 1. Promote RETRYING jobs whose backoff delay has elapsed back to QUEUED state
      await prisma.$executeRaw`
        UPDATE "jobs"
        SET "status" = ${JobStatus.QUEUED}::"JobStatus",
            "updatedAt" = NOW()
        WHERE "status" = ${JobStatus.RETRYING}::"JobStatus"
          AND "availableAt" <= NOW();
      `;

      // 2. Calculate available capacity slots based on worker concurrency limit
      const availableCapacity = CONCURRENCY - activeCount;

      if (availableCapacity > 0) {
        // 3. Atomically claim eligible jobs using FOR UPDATE SKIP LOCKED (with optional queue shard filter)
        const claimedJobs = await claimJobs({
          workerId: WORKER_ID,
          batchSize: availableCapacity,
          queueId: TARGET_QUEUE_ID,
        });

        if (claimedJobs.length > 0) {
          logger.info({ workerId: WORKER_ID, count: claimedJobs.length }, '⚡ Atomically claimed jobs');

          // 4. Dispatch claimed jobs concurrently
          for (const job of claimedJobs) {
            activeCount++;
            heartbeatManager.setActiveJobsCount(activeCount);

            // Execute job asynchronously without blocking polling loop
            executeJob(job, WORKER_ID)
              .catch((err) => {
                logger.error({ jobId: job.id, err }, 'Unhandled error during job execution wrapper');
              })
              .finally(() => {
                activeCount--;
                heartbeatManager.setActiveJobsCount(activeCount);
              });
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (err) {
      logger.error({ workerId: WORKER_ID, err }, 'Error in worker polling loop');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Graceful shutdown procedure handling SIGINT and SIGTERM signals
 */
async function gracefulShutdown(signal: string) {
  logger.info({ workerId: WORKER_ID, signal, activeCount }, '🛑 Graceful worker shutdown initiated. Draining active jobs...');
  isRunning = false;

  const shutdownTimeout = setTimeout(async () => {
    logger.warn({ workerId: WORKER_ID, activeCount }, 'Shutdown timeout reached. Force exiting worker...');
    await heartbeatManager.shutdown();
    process.exit(1);
  }, 10000);

  // Poll until in-flight active jobs complete
  while (activeCount > 0) {
    logger.info({ workerId: WORKER_ID, remainingJobs: activeCount }, 'Draining in-flight jobs...');
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  clearTimeout(shutdownTimeout);
  await heartbeatManager.shutdown();
  logger.info({ workerId: WORKER_ID }, 'Worker process drained and exited cleanly.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startWorker().catch((err) => {
  logger.error({ err }, 'Fatal error starting worker node');
  process.exit(1);
});
