/**
 * ============================================================================
 * Worker Fleet Telemetry Routes — Distributed Job Scheduler
 * ============================================================================
 * Lists registered worker nodes and their active status, thread capacities, and heartbeats.
 */

import { Router, Request, Response } from 'express';
import { prisma, WorkerStatus } from '@job-scheduler/database';
import { authenticateToken } from '../middleware/auth.js';

export const workersRouter = Router();

workersRouter.use(authenticateToken);

/**
 * GET /api/v1/workers
 * Lists worker fleet nodes in PostgreSQL.
 * Supports ?status=ONLINE (default) or ?status=ALL
 */
workersRouter.get('/', async (req: Request, res: Response) => {
  const { status = 'ONLINE' } = req.query;

  const whereClause: Record<string, unknown> = {};
  const cutoff = new Date(Date.now() - 45000);

  if (status === 'ONLINE') {
    // Only return active online workers that sent a heartbeat within the last 45 seconds
    whereClause.status = WorkerStatus.ONLINE;
    whereClause.lastHeartbeatAt = { gte: cutoff };
  } else if (status !== 'ALL' && typeof status === 'string') {
    whereClause.status = status;
  }

  const [workers, totalCount, onlineCount] = await Promise.all([
    prisma.worker.findMany({
      where: whereClause,
      include: {
        heartbeats: {
          orderBy: { timestamp: 'desc' },
          take: 12,
        },
        _count: {
          select: { executions: true, jobs: true },
        },
      },
      orderBy: { lastHeartbeatAt: 'desc' },
    }),
    prisma.worker.count(),
    prisma.worker.count({
      where: {
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: { gte: cutoff },
      },
    }),
  ]);

  res.status(200).json({
    workers,
    counts: {
      total: totalCount,
      online: onlineCount,
    },
  });
});
