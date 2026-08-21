/**
 * ============================================================================
 * Worker Node Heartbeat & Telemetry — Distributed Job Scheduler
 * ============================================================================
 * Registers worker instance on startup and sends periodic heartbeat updates
 * every 5 seconds, recording active job count and memory telemetry.
 */

import os from 'os';
import { prisma, WorkerStatus } from '@job-scheduler/database';
import { logger } from '@job-scheduler/logger';

export class WorkerHeartbeatManager {
  private workerId: string;
  private workerName: string;
  private concurrency: number;
  private timer?: NodeJS.Timeout;
  private activeJobsCount = 0;

  constructor(workerId: string, concurrency: number) {
    this.workerId = workerId;
    this.concurrency = concurrency;
    this.workerName = `Worker-${workerId.slice(-6)}`;
  }

  /**
   * Registers worker in database on startup
   */
  async register(): Promise<void> {
    const hostname = os.hostname();
    const pid = process.pid;

    await prisma.worker.upsert({
      where: { id: this.workerId },
      update: {
        status: WorkerStatus.ONLINE,
        concurrency: this.concurrency,
        lastHeartbeatAt: new Date(),
        stoppedAt: null,
      },
      create: {
        id: this.workerId,
        workerName: this.workerName,
        hostname,
        pid,
        status: WorkerStatus.ONLINE,
        concurrency: this.concurrency,
        activeJobsCount: 0,
        lastHeartbeatAt: new Date(),
      },
    });

    logger.info({ workerId: this.workerId, hostname, pid }, '✅ Worker registered ONLINE in database fleet');
  }

  /**
   * Starts periodic heartbeat interval loop (every 5 seconds)
   */
  startHeartbeatLoop(intervalMs = 5000): void {
    this.timer = setInterval(async () => {
      try {
        const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

        await prisma.$transaction([
          prisma.worker.update({
            where: { id: this.workerId },
            data: {
              lastHeartbeatAt: new Date(),
              activeJobsCount: this.activeJobsCount,
              status: WorkerStatus.ONLINE,
            },
          }),
          prisma.workerHeartbeat.create({
            data: {
              workerId: this.workerId,
              memoryUsage: memoryUsageMB,
              activeJobs: this.activeJobsCount,
            },
          }),
        ]);
      } catch (err) {
        logger.error({ workerId: this.workerId, err }, 'Failed to send worker heartbeat');
      }
    }, intervalMs);
  }

  /**
   * Updates current active in-flight jobs count
   */
  setActiveJobsCount(count: number): void {
    this.activeJobsCount = count;
  }

  /**
   * Marks worker OFFLINE on graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
    }

    try {
      await prisma.worker.update({
        where: { id: this.workerId },
        data: {
          status: WorkerStatus.OFFLINE,
          stoppedAt: new Date(),
          activeJobsCount: 0,
        },
      });
      logger.info({ workerId: this.workerId }, 'Worker status marked OFFLINE in database');
    } catch (err) {
      logger.error({ workerId: this.workerId, err }, 'Error setting worker status to OFFLINE during shutdown');
    }
  }
}
