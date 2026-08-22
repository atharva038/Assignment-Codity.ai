/**
 * ============================================================================
 * Atomic Job Claim Engine — Distributed Job Scheduler
 * ============================================================================
 * Implements high-concurrency atomic job claiming using PostgreSQL's native
 * `SELECT ... FOR UPDATE SKIP LOCKED` row locking mechanism inside a transaction.
 *
 * VIVA EXPLANATION:
 * 1. `FOR UPDATE` locks candidate job rows for the duration of the transaction.
 * 2. `SKIP LOCKED` causes concurrent worker transactions to immediately skip
 *    already-locked rows without blocking or waiting.
 * 3. Guarantees **EXACTLY-ONCE CLAIM SEMANTICS** across any number of worker nodes.
 * 4. Checks queue pause status — if queue status is PAUSED, claiming is skipped.
 */

import { prisma, Prisma, Job, JobStatus } from '@job-scheduler/database';
import { checkRateLimit } from '@job-scheduler/redis';

export interface ClaimJobsOptions {
  workerId: string;
  batchSize: number;
  queueId?: string;
}

/**
 * Atomically claims eligible QUEUED jobs for a worker node.
 * Returns array of claimed Job records.
 */
export async function claimJobs(options: ClaimJobsOptions): Promise<Job[]> {
  const { workerId, batchSize, queueId } = options;

  if (batchSize <= 0) {
    return [];
  }

  // Transactional Atomic Claiming with FOR UPDATE SKIP LOCKED
  const claimedJobs = await prisma.$transaction(async (tx) => {
    // Raw query selecting candidate jobs from ACTIVE queues where availableAt <= NOW()
    const candidateJobs = queueId
      ? await tx.$queryRaw<Array<{ id: string; timeoutMs: number; queueId: string }>>`
          SELECT j."id", j."timeoutMs", j."queueId"
          FROM "jobs" j
          INNER JOIN "queues" q ON j."queueId" = q."id"
          WHERE j."status" = ${JobStatus.QUEUED}::"JobStatus"
            AND j."availableAt" <= NOW()
            AND q."status" = 'ACTIVE'::"QueueStatus"
            AND j."queueId" = ${queueId}
          ORDER BY j."priority" DESC, j."createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${batchSize};
        `
      : await tx.$queryRaw<Array<{ id: string; timeoutMs: number; queueId: string }>>`
          SELECT j."id", j."timeoutMs", j."queueId"
          FROM "jobs" j
          INNER JOIN "queues" q ON j."queueId" = q."id"
          WHERE j."status" = ${JobStatus.QUEUED}::"JobStatus"
            AND j."availableAt" <= NOW()
            AND q."status" = 'ACTIVE'::"QueueStatus"
          ORDER BY j."priority" DESC, j."createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${batchSize};
        `;

    if (candidateJobs.length === 0) {
      return [];
    }

    // Filter candidate jobs by Queue Rate Limits
    const candidateQueueIds = Array.from(new Set(candidateJobs.map(j => j.queueId)));
    const queues = await tx.queue.findMany({
      where: { id: { in: candidateQueueIds } },
      select: { id: true, rateLimitMaxJobs: true, rateLimitWindowMs: true },
    });

    const queueMap = new Map(queues.map(q => [q.id, q]));
    const allowedCandidateIds: string[] = [];

    for (const job of candidateJobs) {
      const q = queueMap.get(job.queueId);
      if (q && q.rateLimitMaxJobs && q.rateLimitMaxJobs > 0) {
        const rateCheck = await checkRateLimit(
          `queue_exec:${q.id}`,
          q.rateLimitMaxJobs,
          q.rateLimitWindowMs || 60000
        );
        if (rateCheck.allowed) {
          allowedCandidateIds.push(job.id);
        }
      } else {
        allowedCandidateIds.push(job.id);
      }
    }

    if (allowedCandidateIds.length === 0) {
      return [];
    }

    // Atomically transition allowed candidate jobs to CLAIMED / RUNNING state
    const now = new Date();
    await tx.$executeRaw`
      UPDATE "jobs"
      SET "status" = ${JobStatus.RUNNING}::"JobStatus",
          "claimedAt" = ${now},
          "startedAt" = ${now},
          "lastWorkerId" = ${workerId},
          "attempts" = "attempts" + 1,
          "lockedUntil" = ${now} + ("timeoutMs" * INTERVAL '1 millisecond'),
          "updatedAt" = ${now}
      WHERE "id" IN (${Prisma.join(allowedCandidateIds)});
    `;

    // Fetch full updated Job objects
    const jobs = await tx.job.findMany({
      where: { id: { in: allowedCandidateIds } },
      include: {
        queue: {
          include: {
            retryPolicy: true,
          },
        },
      },
    });

    return jobs;
  });

  return claimedJobs;
}

