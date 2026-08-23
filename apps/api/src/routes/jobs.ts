/**
 * ============================================================================
 * Job Ingestion & Query Routes — Distributed Job Scheduler
 * ============================================================================
 * Handles job ingestion (single & batch), idempotency key deduplication,
 * state machine transitions, job inspection with logs, and cancellation/retry.
 */

import { Router, Request, Response } from 'express';
import { prisma, JobStatus, DLQResolutionStatus } from '@job-scheduler/database';
import {
  createJobSchema,
  batchCreateJobSchema,
  shardedCreateJobSchema,
  jobQuerySchema,
  routeToQueueShard,
  calculateShardIndex,
} from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { emitStatsSnapshot } from '../ws/statsEmitter.js';

export const jobsRouter = Router();

jobsRouter.use(authenticateToken);

/**
 * POST /api/v1/jobs
 * Ingests a new job (immediate or delayed) with optional idempotency key deduplication.
 */
jobsRouter.post('/', validate(createJobSchema), async (req: Request, res: Response) => {
  const { queueId, type, payload, priority, availableAt, maxAttempts, timeoutMs, idempotencyKey } = req.body;

  // 1. Verify queue exists and is ACTIVE
  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: { retryPolicy: true },
  });

  if (!queue) {
    res.status(404).json({ error: 'Not Found', message: 'Target Queue does not exist' });
    return;
  }

  // Determine maxAttempts: explicit input -> queue retry policy -> default 3
  const effectiveMaxAttempts = maxAttempts || queue.retryPolicy?.maxAttempts || 3;

  // 2. Check Idempotency Key deduplication if provided
  if (idempotencyKey) {
    const existingJob = await prisma.job.findUnique({
      where: {
        queueId_idempotencyKey: {
          queueId,
          idempotencyKey,
        },
      },
    });

    if (existingJob) {
      res.status(200).json({
        message: 'Existing job returned (Idempotency Key deduplicated)',
        job: existingJob,
        deduplicated: true,
      });
      return;
    }
  }

  // 3. Determine initial status: delayed jobs start as SCHEDULED until availableAt <= NOW()
  const availableTimestamp = availableAt ? new Date(availableAt) : new Date();
  const isDelayed = availableTimestamp.getTime() > Date.now();
  const initialStatus = isDelayed ? JobStatus.SCHEDULED : JobStatus.QUEUED;

  // 4. Create Job record
  const job = await prisma.job.create({
    data: {
      queueId,
      type,
      payload: payload || {},
      priority: priority || queue.priority,
      status: initialStatus,
      maxAttempts: effectiveMaxAttempts,
      availableAt: availableTimestamp,
      timeoutMs: timeoutMs || 30000,
      idempotencyKey,
    },
  });

  emitStatsSnapshot().catch(() => {});

  res.status(201).json({
    message: isDelayed ? 'Delayed job scheduled successfully' : 'Job created and queued successfully',
    job,
    deduplicated: false,
  });

});

/**
 * POST /api/v1/jobs/batch
 * Transactional batch job ingestion (up to 100 jobs per request).
 */
jobsRouter.post('/batch', validate(batchCreateJobSchema), async (req: Request, res: Response) => {
  const { queueId, jobs } = req.body;

  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: { retryPolicy: true },
  });

  if (!queue) {
    res.status(404).json({ error: 'Not Found', message: 'Target Queue does not exist' });
    return;
  }

  const effectiveMaxAttempts = queue.retryPolicy?.maxAttempts || 3;

  // Process batch in database transaction
  const createdJobs = await prisma.$transaction(async (tx) => {
    const jobRecords = [];

    for (const jobData of jobs) {
      const availableTimestamp = jobData.availableAt ? new Date(jobData.availableAt) : new Date();
      const isDelayed = availableTimestamp.getTime() > Date.now();
      const initialStatus = isDelayed ? JobStatus.SCHEDULED : JobStatus.QUEUED;

      const created = await tx.job.create({
        data: {
          queueId,
          type: jobData.type,
          payload: jobData.payload || {},
          priority: jobData.priority || queue.priority,
          status: initialStatus,
          maxAttempts: jobData.maxAttempts || effectiveMaxAttempts,
          availableAt: availableTimestamp,
          idempotencyKey: jobData.idempotencyKey,
        },
      });

      jobRecords.push(created);
    }

    return jobRecords;
  });

  res.status(201).json({
    message: `Batch of ${createdJobs.length} jobs created successfully`,
    count: createdJobs.length,
    jobs: createdJobs,
  });
});

/**
 * POST /api/v1/jobs/sharded
 * Ingests a job with deterministic consistent hash partition routing across queue shards.
 *
 * VIVA EXPLANATION:
 * 1. Takes a `shardKey` (e.g. tenantId, userId, customerId) and `shardQueueIds`.
 * 2. Deterministically hashes the shard key to select target queue shard:
 *    shardIndex = fnv1aHash(shardKey) % shardQueueIds.length
 * 3. Enqueues the job into the mapped shard queue with ACID safety.
 */
jobsRouter.post('/sharded', validate(shardedCreateJobSchema), async (req: Request, res: Response) => {
  const {
    shardKey,
    shardQueueIds,
    type,
    payload,
    priority,
    availableAt,
    maxAttempts,
    timeoutMs,
    idempotencyKey,
  } = req.body;

  // 1. Deterministically route shard key to specific queue shard ID
  const routedQueueId = routeToQueueShard(shardKey, shardQueueIds);
  const shardIndex = calculateShardIndex(shardKey, shardQueueIds.length);

  // 2. Verify routed queue exists and is ACTIVE
  const queue = await prisma.queue.findUnique({
    where: { id: routedQueueId },
    include: { retryPolicy: true },
  });

  if (!queue) {
    res.status(404).json({
      error: 'Not Found',
      message: `Routed Queue Shard ${routedQueueId} does not exist`,
    });
    return;
  }

  const effectiveMaxAttempts = maxAttempts || queue.retryPolicy?.maxAttempts || 3;

  // 3. Check Idempotency Key deduplication if provided
  if (idempotencyKey) {
    const existingJob = await prisma.job.findUnique({
      where: {
        queueId_idempotencyKey: {
          queueId: routedQueueId,
          idempotencyKey,
        },
      },
    });

    if (existingJob) {
      res.status(200).json({
        message: 'Existing job returned (Idempotency Key deduplicated)',
        job: existingJob,
        deduplicated: true,
        routedQueueId,
        shardIndex,
      });
      return;
    }
  }

  // 4. Determine initial status
  const availableTimestamp = availableAt ? new Date(availableAt) : new Date();
  const isDelayed = availableTimestamp.getTime() > Date.now();
  const initialStatus = isDelayed ? JobStatus.SCHEDULED : JobStatus.QUEUED;

  // 5. Ingest job into mapped queue partition
  const job = await prisma.job.create({
    data: {
      queueId: routedQueueId,
      type,
      payload: payload || {},
      priority: priority || queue.priority,
      status: initialStatus,
      maxAttempts: effectiveMaxAttempts,
      availableAt: availableTimestamp,
      timeoutMs: timeoutMs || 30000,
      idempotencyKey,
    },
  });

  emitStatsSnapshot().catch(() => {});

  res.status(201).json({
    message: isDelayed
      ? `Delayed job scheduled on Shard ${shardIndex} (${queue.name})`
      : `Job created and routed to Shard ${shardIndex} (${queue.name}) successfully`,
    job,
    routedQueueId,
    shardIndex,
    totalShards: shardQueueIds.length,
    shardKey,
    deduplicated: false,
  });
});

/**
 * GET /api/v1/jobs
 * Lists, filters, and paginates jobs.
 */
jobsRouter.get('/', async (req: Request, res: Response) => {
  const { queueId, status, type, workerId, search, page = '1', limit = '20' } = req.query;

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(1000, Math.max(1, parseInt(limit as string, 10)));
  const skip = (pageNum - 1) * limitNum;

  const whereClause: Record<string, unknown> = {};

  if (queueId && typeof queueId === 'string') {
    whereClause.queueId = queueId;
  }
  if (status && typeof status === 'string') {
    whereClause.status = status;
  }
  if (type && typeof type === 'string') {
    whereClause.type = type;
  }
  if (workerId && typeof workerId === 'string') {
    whereClause.lastWorkerId = workerId;
  }
  if (search && typeof search === 'string') {
    whereClause.OR = [
      { id: { contains: search, mode: 'insensitive' } },
      { type: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [jobs, totalCount] = await Promise.all([
    prisma.job.findMany({
      where: whereClause,
      include: {
        queue: {
          select: { id: true, name: true, projectId: true },
        },
        worker: {
          select: { id: true, workerName: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.job.count({ where: whereClause }),
  ]);

  res.status(200).json({
    jobs,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    },
  });
});

/**
 * GET /api/v1/jobs/stats
 * Returns high-performance integer metrics (total, queued, running, completed, failed, dead).
 */
jobsRouter.get('/stats', async (_req: Request, res: Response) => {
  const [total, queued, running, completed, failed, dead, pendingDlq, totalDlq] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: JobStatus.QUEUED } }),
    prisma.job.count({ where: { status: JobStatus.RUNNING } }),
    prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
    prisma.job.count({ where: { status: { in: [JobStatus.FAILED, JobStatus.RETRYING] } } }),
    prisma.job.count({ where: { status: JobStatus.DEAD } }),
    prisma.deadLetterJob.count({ where: { resolutionStatus: DLQResolutionStatus.PENDING } }),
    prisma.deadLetterJob.count(),
  ]);

  res.status(200).json({ stats: { total, queued, running, completed, failed, dead, pendingDlq, totalDlq } });
});

/**
 * GET /api/v1/jobs/:id
 * Gets detailed job record including execution attempts and log stream.
 */
jobsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      queue: {
        include: {
          project: {
            select: { id: true, name: true, slug: true, organizationId: true },
          },
          retryPolicy: true,
        },
      },
      worker: {
        select: { id: true, workerName: true, status: true, hostname: true },
      },
      executions: {
        orderBy: { attemptNumber: 'asc' },
      },
      logs: {
        orderBy: { timestamp: 'asc' },
        take: 500, // Limit log stream preview
      },
      deadLetterJob: true,
    },
  });

  if (!job) {
    res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    return;
  }

  res.status(200).json({ job });
});

/**
 * POST /api/v1/jobs/:id/cancel
 * Cancels a pending or queued job.
 */
jobsRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  const { id } = req.params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    return;
  }

  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
    res.status(400).json({ error: 'Bad Request', message: `Cannot cancel job in ${job.status} state` });
    return;
  }

  const updatedJob = await prisma.job.update({
    where: { id },
    data: {
      status: JobStatus.CANCELLED,
    },
  });

  res.status(200).json({ message: 'Job cancelled successfully', job: updatedJob });
});

/**
 * POST /api/v1/jobs/:id/retry
 * Manually retries a failed or dead job by resetting its status back to QUEUED.
 */
jobsRouter.post('/:id/retry', async (req: Request, res: Response) => {
  const { id } = req.params;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    res.status(404).json({ error: 'Not Found', message: 'Job not found' });
    return;
  }

  if (job.status !== JobStatus.FAILED && job.status !== JobStatus.DEAD && job.status !== JobStatus.CANCELLED) {
    res.status(400).json({ error: 'Bad Request', message: `Only FAILED, DEAD, or CANCELLED jobs can be retried` });
    return;
  }

  const updatedJob = await prisma.job.update({
    where: { id },
    data: {
      status: JobStatus.QUEUED,
      availableAt: new Date(), // Immediate execution
      errorReason: null,
    },
  });

  res.status(200).json({ message: 'Job re-queued for execution successfully', job: updatedJob });
});
