/**
 * ============================================================================
 * Stale Worker & Orphaned Lease Crash Recovery Reaper — Scheduler Service
 * ============================================================================
 * Detects crashed worker processes and recovers stuck/orphaned job leases.
 *
 * ARCHITECTURAL RATIONALE:
 * 1. Stale Worker Reaper: Workers missing heartbeats for >30s transition to `OFFLINE`.
 * 2. Orphaned Lease Recovery Reaper: Jobs stuck in `CLAIMED` or `RUNNING` whose
 *    `lockedUntil` timestamp has expired (worker crashed mid-handler execution)
 *    are automatically re-queued to `QUEUED` with `availableAt = NOW()`.
 * 3. Guarantees **ZERO LOST OR PERMANENTLY STUCK JOBS** under process crashes.
 */

import { prisma, JobStatus, WorkerStatus, DLQResolutionStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';

export async function reapStaleWorkers(staleTimeoutMs = 30000): Promise<number> {
  const staleCutoff = new Date(Date.now() - staleTimeoutMs);

  const result = await prisma.worker.updateMany({
    where: {
      status: WorkerStatus.ONLINE,
      lastHeartbeatAt: { lt: staleCutoff },
    },
    data: {
      status: WorkerStatus.OFFLINE,
      stoppedAt: new Date(),
    },
  });

  if (result.count > 0) {
    logger.warn({ count: result.count, cutoff: staleCutoff.toISOString() }, '⚠️ Reaped stale workers missing heartbeats');
  }

  return result.count;
}

export async function recoverOrphanedJobLeases(): Promise<number> {
  const now = new Date();

  // Find all stuck jobs where lockedUntil < NOW()
  const stuckJobs = await prisma.job.findMany({
    where: {
      status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
      lockedUntil: { lt: now },
    },
    include: { queue: true },
  });

  if (stuckJobs.length === 0) {
    return 0;
  }

  let recoveredCount = 0;

  for (const job of stuckJobs) {
    try {
      if (job.attempts < job.maxAttempts) {
        // Re-queue job for immediate execution by a healthy worker
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: JobStatus.QUEUED,
            availableAt: now,
            lockedUntil: null,
            errorReason: `Lease expired: worker ${job.lastWorkerId || 'unknown'} crashed mid-execution`,
          },
        });

        await prisma.jobLog.create({
          data: {
            jobId: job.id,
            level: 'WARN',
            message: `Crash Recovery Reaper re-queued stuck job (worker ${job.lastWorkerId || 'unknown'} lease expired)`,
          },
        });

        recoveredCount++;
        logger.warn({ jobId: job.id, lastWorkerId: job.lastWorkerId }, '🔄 Orphaned job lease recovered & re-queued');
      } else {
        // Max attempts exhausted: route to Dead Letter Queue (DLQ)
        await prisma.$transaction([
          prisma.job.update({
            where: { id: job.id },
            data: {
              status: JobStatus.DEAD,
              failedAt: now,
              lockedUntil: null,
              errorReason: `Lease expired and max attempts (${job.maxAttempts}) reached`,
            },
          }),
          prisma.deadLetterJob.upsert({
            where: { originalJobId: job.id },
            update: {
              attempts: job.attempts,
              finalErrorReason: `Lease expired: worker ${job.lastWorkerId || 'unknown'} crashed`,
              failedWorkerId: job.lastWorkerId,
              resolutionStatus: DLQResolutionStatus.PENDING,
            },
            create: {
              originalJobId: job.id,
              queueId: job.queueId,
              attempts: job.attempts,
              finalErrorReason: `Lease expired: worker ${job.lastWorkerId || 'unknown'} crashed`,
              failedWorkerId: job.lastWorkerId,
              resolutionStatus: DLQResolutionStatus.PENDING,
            },
          }),
        ]);

        recoveredCount++;
        logger.error({ jobId: job.id }, '☠️ Orphaned job lease expired with max attempts. Routed to DLQ');
      }
    } catch (err) {
      logger.error({ jobId: job.id, err }, 'Error recovering orphaned job lease');
    }
  }

  return recoveredCount;
}
