/**
 * ============================================================================
 * Cron Evaluation & Multi-Replica Optimistic Lock Engine — Scheduler Service
 * ============================================================================
 * Evaluates recurring cron schedules and triggers job instance creation.
 *
 * VIVA EXPLANATION:
 * 1. Optimistic Locking: Uses `lockToken` + `lockExpiresAt` to guarantee that
 *    when multiple scheduler replicas run in parallel, ONLY ONE replica claims
 *    and triggers a cron tick.
 * 2. Auto-expiry dead-man timer: `lockExpiresAt` prevents deadlocks if a scheduler
 *    replica crashes mid-evaluation.
 */

import cronParser from 'cron-parser';
import { randomUUID } from 'crypto';
import { prisma, JobStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';
import { publishJobEvent } from '@job-scheduler/redis';

export async function evaluateCronSchedules(schedulerId: string): Promise<number> {
  const now = new Date();

  // 1. Find all enabled scheduled jobs where nextRunAt <= NOW()
  const dueScheduledJobs = await prisma.scheduledJob.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now },
      queue: { status: 'ACTIVE' },
    },
    include: { queue: true },
  });

  if (dueScheduledJobs.length === 0) {
    return 0;
  }

  let triggeredCount = 0;

  for (const item of dueScheduledJobs) {
    const lockToken = `lock-${schedulerId}-${randomUUID().slice(0, 8)}`;

    try {
      // 2. Attempt Optimistic Lock acquisition
      const lockAcquiredCount = await prisma.$executeRaw`
        UPDATE "scheduled_jobs"
        SET "lockToken" = ${lockToken},
            "lockExpiresAt" = NOW() + INTERVAL '10 seconds'
        WHERE "id" = ${item.id}
          AND ("lockToken" IS NULL OR "lockExpiresAt" < NOW());
      `;

      if (lockAcquiredCount === 0) {
        // Lock claimed by another parallel scheduler replica — skip
        continue;
      }

      // 3. Compute next run timestamp from cron expression
      let nextRunAt: Date;
      try {
        const interval = cronParser.parseExpression(item.cronExpression, { currentDate: now });
        nextRunAt = interval.next().toDate();
      } catch (err) {
        logger.error({ scheduledJobId: item.id, cron: item.cronExpression, err }, 'Invalid cron expression encountered during execution');
        continue;
      }

      // 4. Create new Job instance and advance nextRunAt in database transaction
      const [newJob] = await prisma.$transaction([
        prisma.job.create({
          data: {
            queueId: item.queueId,
            type: item.jobType,
            payload: (item.payload as object) || {},
            priority: item.priority || item.queue.priority,
            status: JobStatus.QUEUED,
            availableAt: now,
          },
        }),
        prisma.scheduledJob.update({
          where: { id: item.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            lockToken: null,
            lockExpiresAt: null,
          },
        }),
      ]);

      triggeredCount++;
      logger.info({ scheduledJobName: item.name, nextRunAt: nextRunAt.toISOString() }, '⏰ Recurring cron job triggered successfully');

      // 5. Broadcast real-time WebSocket event for instant UI update
      publishJobEvent({
        type: 'job:updated',
        payload: {
          jobId: newJob.id,
          queueId: item.queueId,
          status: JobStatus.QUEUED,
          batchSize: 1,
          scheduledJobId: item.id,
        },
      }).catch(() => {});
    } catch (err) {
      logger.error({ scheduledJobId: item.id, err }, 'Failed to trigger scheduled cron job');
    }
  }

  return triggeredCount;
}
