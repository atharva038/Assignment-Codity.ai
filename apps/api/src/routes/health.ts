/**
 * ============================================================================
 * Health & Diagnostics Router — Distributed Job Scheduler API
 * ============================================================================
 * Returns current API status, uptime, system metrics, and database connectivity.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@job-scheduler/database';

export const healthRouter = Router();

healthRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    // Quick db ping test
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
      database: 'connected',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
