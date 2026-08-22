/**
 * ============================================================================
 * Queue Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Provides Queue CRUD, configuration adjustments (priority & concurrency),
 * pause/resume administrative toggles, and live queue statistics summaries.
 */

import { Router, Request, Response } from 'express';
import { prisma, QueueStatus, JobStatus } from '@job-scheduler/database';
import { createQueueSchema, updateQueueSchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

export const queuesRouter = Router();

queuesRouter.use(authenticateToken);

/**
 * POST /api/v1/queues
 * Creates a queue under a project.
 */
queuesRouter.post('/', validate(createQueueSchema), async (req: Request, res: Response) => {
  let targetProjectId = req.body.projectId;
  const { name, priority, concurrencyLimit, retryPolicyId } = req.body;

  if (!targetProjectId) {
    const userProj = await prisma.project.findFirst();
    targetProjectId = userProj?.id;
  }

  if (!targetProjectId) {
    res.status(400).json({ error: 'Bad Request', message: 'No project available to assign queue' });
    return;
  }

  // Check unique queue name per project
  const existingQueue = await prisma.queue.findUnique({
    where: {
      projectId_name: {
        projectId: targetProjectId,
        name,
      },
    },
  });

  if (existingQueue) {
    res.status(409).json({ error: 'Conflict', message: 'A queue with this name already exists in the project' });
    return;
  }

  const queue = await prisma.queue.create({
    data: {
      projectId: targetProjectId,
      name,
      priority,
      concurrencyLimit,
      retryPolicyId,
    },
    include: {
      retryPolicy: true,
    },
  });

  res.status(201).json({ message: 'Queue created successfully', queue });
});

/**
 * GET /api/v1/queues
 * Lists queues (optionally filtered by projectId).
 */
queuesRouter.get('/', async (req: Request, res: Response) => {
  const { projectId, status } = req.query;

  const whereClause: Record<string, unknown> = {};
  if (projectId && typeof projectId === 'string') {
    whereClause.projectId = projectId;
  }
  if (status && (status === 'ACTIVE' || status === 'PAUSED')) {
    whereClause.status = status;
  }

  const queues = await prisma.queue.findMany({
    where: whereClause,
    include: {
      project: {
        select: { id: true, name: true, slug: true, organizationId: true },
      },
      retryPolicy: true,
      _count: {
        select: { jobs: true },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  res.status(200).json({ queues });
});

/**
 * GET /api/v1/queues/:id
 * Retrieves queue details and attached policy.
 */
queuesRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const queue = await prisma.queue.findUnique({
    where: { id },
    include: {
      project: {
        select: { id: true, name: true, slug: true, organizationId: true },
      },
      retryPolicy: true,
    },
  });

  if (!queue) {
    res.status(404).json({ error: 'Not Found', message: 'Queue not found' });
    return;
  }

  res.status(200).json({ queue });
});

/**
 * PUT /api/v1/queues/:id
 * Updates queue priority, concurrency limit, status, or retry policy.
 */
queuesRouter.put('/:id', validate(updateQueueSchema), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { priority, concurrencyLimit, status, retryPolicyId } = req.body;

  const existingQueue = await prisma.queue.findUnique({ where: { id } });
  if (!existingQueue) {
    res.status(404).json({ error: 'Not Found', message: 'Queue not found' });
    return;
  }

  const queue = await prisma.queue.update({
    where: { id },
    data: {
      ...(priority !== undefined && { priority }),
      ...(concurrencyLimit !== undefined && { concurrencyLimit }),
      ...(status !== undefined && { status }),
      ...(retryPolicyId !== undefined && { retryPolicyId }),
    },
    include: {
      retryPolicy: true,
    },
  });

  res.status(200).json({ message: 'Queue updated successfully', queue });
});

/**
 * POST /api/v1/queues/:id/pause
 * Pauses queue execution. Workers will skip claiming jobs from this queue.
 */
queuesRouter.post('/:id/pause', async (req: Request, res: Response) => {
  const { id } = req.params;

  const queue = await prisma.queue.update({
    where: { id },
    data: { status: QueueStatus.PAUSED },
  });

  res.status(200).json({ message: 'Queue paused successfully', queue });
});

/**
 * POST /api/v1/queues/:id/resume
 * Resumes paused queue execution.
 */
queuesRouter.post('/:id/resume', async (req: Request, res: Response) => {
  const { id } = req.params;

  const queue = await prisma.queue.update({
    where: { id },
    data: { status: QueueStatus.ACTIVE },
  });

  res.status(200).json({ message: 'Queue resumed successfully', queue });
});

/**
 * GET /api/v1/queues/:id/stats
 * Returns live job status counts for the specified queue.
 */
queuesRouter.get('/:id/stats', async (req: Request, res: Response) => {
  const { id } = req.params;

  const counts = await prisma.job.groupBy({
    by: ['status'],
    where: { queueId: id },
    _count: { _all: true },
  });

  const stats: Record<string, number> = {
    BLOCKED: 0,
    QUEUED: 0,
    SCHEDULED: 0,
    CLAIMED: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    RETRYING: 0,
    DEAD: 0,
    CANCELLED: 0,
    total: 0,
  };

  counts.forEach((item) => {
    stats[item.status] = item._count._all;
    stats.total += item._count._all;
  });

  res.status(200).json({ queueId: id, stats });
});
