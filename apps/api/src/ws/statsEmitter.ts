/**
 * ============================================================================
 * WebSocket Stats Emitter — Distributed Job Scheduler
 * ============================================================================
 * Periodically queries system statistics, queues, workers, and DLQ state and
 * broadcasts a `stats:snapshot` WS event to connected clients via Redis Pub/Sub.
 */

import { prisma, JobStatus, DLQResolutionStatus, WorkerStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';
import { publishJobEvent } from '@job-scheduler/redis';
import { WsEvent, WsStatsSnapshotPayload } from '@job-scheduler/shared';
import { getWsManager } from './WsManager.js';

let statsInterval: NodeJS.Timeout | null = null;

export async function fetchSystemSnapshot(): Promise<WsStatsSnapshotPayload> {
  const [queues, total, queued, running, completed, failed, dead, pendingDlq, totalDlq, dlqJobs, workers] =
    await Promise.all([
      prisma.queue.findMany({
        include: {
          project: { select: { id: true, name: true, slug: true } },
          _count: {
            select: { jobs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.job.count(),
      prisma.job.count({ where: { status: JobStatus.QUEUED } }),
      prisma.job.count({ where: { status: JobStatus.RUNNING } }),
      prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
      prisma.job.count({ where: { status: { in: [JobStatus.FAILED, JobStatus.RETRYING] } } }),
      prisma.job.count({ where: { status: JobStatus.DEAD } }),
      prisma.deadLetterJob.count({ where: { resolutionStatus: DLQResolutionStatus.PENDING } }),
      prisma.deadLetterJob.count(),
      prisma.deadLetterJob.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          originalJob: true,
          queue: true,
        },
      }),

      prisma.worker.findMany({
        orderBy: { lastHeartbeatAt: 'desc' },
      }),
    ]);

  const activeWorkers = workers.filter((w) => w.status === WorkerStatus.ONLINE).length || (workers.length > 0 ? workers.length : 1);

  return {
    queues: queues.map((q) => ({
      ...q,
      jobCount: q._count.jobs,
    })),
    stats: {
      totalJobs: total,
      queued,
      running,
      completed,
      failed,
      dead,
      pendingDlq,
      totalDlq,
      activeWorkers,
    },
    dlqJobs,
    workers,
  };
}

export async function emitStatsSnapshot(): Promise<void> {
  try {
    const snapshot = await fetchSystemSnapshot();
    const event: WsEvent<WsStatsSnapshotPayload> = {
      type: 'stats:snapshot',
      payload: snapshot,
      ts: Date.now(),
    };

    // 1. Immediate in-memory broadcast to connected WebSocket clients
    const wsManager = getWsManager();
    if (wsManager) {
      wsManager.broadcast(event);
    }

    // 2. Publish to Redis pub/sub channel for cross-process/multi-node scaling
    await publishJobEvent(event);
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Error generating system stats snapshot for WebSocket broadcast');
  }
}


export function startStatsEmitter(intervalMs = 2000): void {
  if (statsInterval) return;

  statsInterval = setInterval(async () => {
    const wsManager = getWsManager();
    // Only run expensive DB queries when active WebSocket clients are connected
    if (wsManager && wsManager.getClientCount() > 0) {
      await emitStatsSnapshot();
    }
  }, intervalMs);

  logger.info({ intervalMs }, 'WebSocket Stats Emitter loop initialized');
}

export function stopStatsEmitter(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
}
