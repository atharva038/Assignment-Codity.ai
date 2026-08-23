/**
 * ============================================================================
 * Dead Letter Queue (DLQ) Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Enables administrators to inspect permanently failed jobs, inspect stack traces,
 * replay dead jobs back into active queues, and archive exhausted entries.
 */

import { Router, Request, Response } from 'express';
import { prisma, JobStatus, DLQResolutionStatus, Role } from '@job-scheduler/database';
import { authenticateToken } from '../middleware/auth.js';
import { requireSystemRole } from '../middleware/rbac.js';
import { getActiveOrgId } from '../middleware/tenant.js';

export const dlqRouter = Router();

dlqRouter.use(authenticateToken);

/**
 * GET /api/v1/dlq
 * Lists dead-letter queue entries with filtering by resolution status and pagination.
 */
dlqRouter.get('/', async (req: Request, res: Response) => {
  const { queueId, resolutionStatus, page = '1', limit = '20' } = req.query;
  const activeOrgId = getActiveOrgId(req);

  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const skip = (pageNum - 1) * limitNum;

  const whereClause: Record<string, unknown> = {};

  if (queueId && typeof queueId === 'string') {
    whereClause.queueId = queueId;
  } else if (activeOrgId) {
    whereClause.queue = { project: { organizationId: activeOrgId } };
  }
  if (resolutionStatus && (resolutionStatus === 'PENDING' || resolutionStatus === 'RETRIED' || resolutionStatus === 'ARCHIVED')) {
    whereClause.resolutionStatus = resolutionStatus;
  }

  const [deadLetterJobs, totalCount] = await Promise.all([
    prisma.deadLetterJob.findMany({
      where: whereClause,
      include: {
        originalJob: {
          select: {
            id: true,
            type: true,
            payload: true,
            priority: true,
            createdAt: true,
          },
        },
        queue: {
          select: { id: true, name: true, projectId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.deadLetterJob.count({ where: whereClause }),
  ]);

  res.status(200).json({
    deadLetterJobs,
    pagination: {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    },
  });
});

/**
 * GET /api/v1/dlq/:id
 * Retrieves a detailed DLQ record with the original Job's full execution history and logs.
 */
dlqRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const dlqJob = await prisma.deadLetterJob.findUnique({
    where: { id },
    include: {
      originalJob: {
        include: {
          executions: {
            orderBy: { attemptNumber: 'asc' },
          },
          logs: {
            orderBy: { timestamp: 'asc' },
            take: 200,
          },
        },
      },
      queue: {
        include: {
          project: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!dlqJob) {
    res.status(404).json({ error: 'Not Found', message: 'Dead Letter Job not found' });
    return;
  }

  res.status(200).json({ deadLetterJob: dlqJob });
});

/**
 * POST /api/v1/dlq/:id/retry
 * Replays a dead job (ADMIN ONLY): creates a brand-new Job in QUEUED state and marks DLQ resolutionStatus = RETRIED.
 */
dlqRouter.post('/:id/retry', requireSystemRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const { id } = req.params;

  const dlqJob = await prisma.deadLetterJob.findUnique({
    where: { id },
    include: { originalJob: true },
  });

  if (!dlqJob) {
    res.status(404).json({ error: 'Not Found', message: 'Dead Letter Job not found' });
    return;
  }

  if (dlqJob.resolutionStatus === DLQResolutionStatus.RETRIED) {
    res.status(400).json({ error: 'Bad Request', message: 'This Dead Letter Job has already been retried' });
    return;
  }

  // Transaction: Re-create job row and update DLQ resolution
  const result = await prisma.$transaction(async (tx) => {
    const newJob = await tx.job.create({
      data: {
        queueId: dlqJob.queueId,
        type: dlqJob.originalJob.type,
        payload: dlqJob.originalJob.payload || {},
        priority: dlqJob.originalJob.priority,
        status: JobStatus.QUEUED,
        maxAttempts: dlqJob.originalJob.maxAttempts,
        availableAt: new Date(), // Immediate execution
      },
    });

    const updatedDlq = await tx.deadLetterJob.update({
      where: { id },
      data: {
        resolutionStatus: DLQResolutionStatus.RETRIED,
        resolvedAt: new Date(),
      },
    });

    return { newJob, updatedDlq };
  });

  res.status(200).json({
    message: 'Dead Letter Job replayed successfully into a new Queued Job',
    replayedJob: result.newJob,
    deadLetterJob: result.updatedDlq,
  });
});

/**
 * POST /api/v1/dlq/:id/archive
 * Archives a dead job (ADMIN ONLY - marks resolutionStatus = ARCHIVED).
 */
dlqRouter.post('/:id/archive', requireSystemRole([Role.ADMIN]), async (req: Request, res: Response) => {
  const { id } = req.params;

  const dlqJob = await prisma.deadLetterJob.findUnique({ where: { id } });
  if (!dlqJob) {
    res.status(404).json({ error: 'Not Found', message: 'Dead Letter Job not found' });
    return;
  }

  const updatedDlq = await prisma.deadLetterJob.update({
    where: { id },
    data: {
      resolutionStatus: DLQResolutionStatus.ARCHIVED,
      resolvedAt: new Date(),
    },
  });

  res.status(200).json({ message: 'Dead Letter Job archived successfully', deadLetterJob: updatedDlq });
});

/**
 * POST /api/v1/dlq/:id/ai-summary
 * Triggers AI failure analysis for a dead letter job, saves the summary in database, and returns results.
 */
dlqRouter.post('/:id/ai-summary', async (req: Request, res: Response) => {
  const { id } = req.params;

  const dlqJob = await prisma.deadLetterJob.findUnique({
    where: { id },
    include: {
      originalJob: {
        include: {
          logs: { orderBy: { timestamp: 'asc' }, take: 50 },
        },
      },
    },
  });

  if (!dlqJob) {
    res.status(404).json({ error: 'Not Found', message: 'Dead Letter Job not found' });
    return;
  }

  // Import AI summarizer service
  const { analyzeJobFailure } = await import('../services/aiSummarizer.js');

  const diagnosticResult = await analyzeJobFailure({
    jobType: dlqJob.originalJob.type,
    payload: (dlqJob.originalJob.payload as Record<string, unknown>) || {},
    attempts: dlqJob.attempts,
    finalErrorReason: dlqJob.finalErrorReason || undefined,
    stackTrace: dlqJob.stackTrace || undefined,
    logs: dlqJob.originalJob.logs.map((l) => ({ level: l.level, message: l.message, timestamp: l.timestamp })),
  });

  // Save diagnostic summary to database
  const updatedDlq = await prisma.deadLetterJob.update({
    where: { id },
    data: {
      aiSummary: diagnosticResult.summary,
      aiSuggestedFix: diagnosticResult.suggestedFix,
      aiAnalyzedAt: new Date(diagnosticResult.analyzedAt),
    },
  });

  res.status(200).json({
    message: 'AI failure summary generated successfully',
    diagnostic: diagnosticResult,
    deadLetterJob: updatedDlq,
  });
});
