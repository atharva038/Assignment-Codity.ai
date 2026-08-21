/**
 * ============================================================================
 * Delayed Job Promoter — Scheduler Service
 * ============================================================================
 * Scans `Job` table for delayed jobs in `SCHEDULED` status whose `availableAt`
 * timestamp has elapsed (`availableAt <= NOW()`), promoting them to `QUEUED`.
 */

import { prisma, JobStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';

export async function promoteDelayedJobs(): Promise<number> {
  const promotedCount = await prisma.$executeRaw`
    UPDATE "jobs"
    SET "status" = ${JobStatus.QUEUED}::"JobStatus",
        "updatedAt" = NOW()
    WHERE "status" = ${JobStatus.SCHEDULED}::"JobStatus"
      AND "availableAt" <= NOW();
  `;

  if (promotedCount > 0) {
    logger.info({ count: promotedCount }, '🚀 Promoted delayed jobs from SCHEDULED to QUEUED');
  }

  return promotedCount;
}
