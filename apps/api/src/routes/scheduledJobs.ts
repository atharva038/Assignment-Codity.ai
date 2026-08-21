/**
 * ============================================================================
 * Scheduled & Cron Job Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Enables creation, listing, and enabling/disabling of recurring cron jobs.
 */

import { Router, Request, Response } from 'express';
import cronParser from 'cron-parser';
import { prisma } from '@job-scheduler/database';
import { createScheduledJobSchema, toggleScheduledJobSchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

export const scheduledJobsRouter = Router();

scheduledJobsRouter.use(authenticateToken);

/**
 * POST /api/v1/scheduled-jobs
 * Creates a recurring scheduled cron job.
 */
scheduledJobsRouter.post('/', validate(createScheduledJobSchema), async (req: Request, res: Response) => {
  const { projectId, queueId, name, cronExpression, jobType, payload, priority, enabled } = req.body;

  // Calculate first nextRunAt from cron expression
  const interval = cronParser.parseExpression(cronExpression);
  const nextRunAt = interval.next().toDate();

  const scheduledJob = await prisma.scheduledJob.create({
    data: {
      projectId,
      queueId,
      name,
      cronExpression,
      jobType,
      payload: payload || {},
      priority: priority || 10,
      enabled: enabled !== undefined ? enabled : true,
      nextRunAt,
    },
    include: {
      queue: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({ message: 'Scheduled cron job created successfully', scheduledJob });
});

/**
 * GET /api/v1/scheduled-jobs
 * Lists scheduled recurring jobs.
 */
scheduledJobsRouter.get('/', async (req: Request, res: Response) => {
  const { projectId, queueId } = req.query;

  const whereClause: Record<string, unknown> = {};
  if (projectId && typeof projectId === 'string') {
    whereClause.projectId = projectId;
  }
  if (queueId && typeof queueId === 'string') {
    whereClause.queueId = queueId;
  }

  const scheduledJobs = await prisma.scheduledJob.findMany({
    where: whereClause,
    include: {
      project: { select: { id: true, name: true, slug: true } },
      queue: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ scheduledJobs });
});

/**
 * POST /api/v1/scheduled-jobs/:id/toggle
 * Enables or disables a scheduled cron job.
 */
scheduledJobsRouter.post('/:id/toggle', validate(toggleScheduledJobSchema), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { enabled } = req.body;

  const existing = await prisma.scheduledJob.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not Found', message: 'Scheduled job not found' });
    return;
  }

  let nextRunAt = existing.nextRunAt;
  if (enabled && !existing.enabled) {
    // Re-evaluate next run time if re-enabling
    const interval = cronParser.parseExpression(existing.cronExpression);
    nextRunAt = interval.next().toDate();
  }

  const updated = await prisma.scheduledJob.update({
    where: { id },
    data: {
      enabled,
      nextRunAt,
    },
  });

  res.status(200).json({ message: `Scheduled job ${enabled ? 'enabled' : 'disabled'} successfully`, scheduledJob: updated });
});
