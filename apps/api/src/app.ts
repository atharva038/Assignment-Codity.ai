/**
 * ============================================================================
 * Express Application Setup — Distributed Job Scheduler
 * ============================================================================
 * Express application configuration with security headers (Helmet), CORS, JSON
 * body parser, request logging, route registration, and centralized error handling.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from '@job-scheduler/logger';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { organizationsRouter } from './routes/organizations.js';
import { projectsRouter } from './routes/projects.js';
import { retryPoliciesRouter } from './routes/retryPolicies.js';
import { queuesRouter } from './routes/queues.js';
import { jobsRouter } from './routes/jobs.js';
import { dlqRouter } from './routes/dlq.js';
import { scheduledJobsRouter } from './routes/scheduledJobs.js';
import { workersRouter } from './routes/workers.js';
import { workflowsRouter } from './routes/workflows.js';
import { eventsRouter } from './routes/events.js';

import { createRateLimiter } from './middleware/rateLimit.js';

export function createApp(): Express {
  const app = express();

  // Security headers & Cross-Origin Resource Sharing
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Global API Rate Limiter (600 req/min for rich real-time dashboards)
  const globalLimiter = createRateLimiter({
    windowMs: 60000,
    limit: 600,
    keyPrefix: 'global',
  });

  // Strict Auth Rate Limiter (30 req/min for login & register)
  const strictAuthLimiter = createRateLimiter({
    windowMs: 60000,
    limit: 30,
    keyPrefix: 'auth',
  });

  // Job Creation Ingestion Rate Limiter (300 req/min)
  const jobIngestionLimiter = createRateLimiter({
    windowMs: 60000,
    limit: 300,
    keyPrefix: 'jobs_ingest',
  });

  // HTTP Request Logging Middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url }, `Incoming HTTP Request`);
    next();
  });

  // Base Health Diagnostic Route
  app.use('/', healthRouter);
  app.use('/api/v1', globalLimiter, healthRouter);

  // API v1 Resource Routers with Rate Limiters
  app.use('/api/v1/auth/login', strictAuthLimiter);
  app.use('/api/v1/auth/register', strictAuthLimiter);
  app.use('/api/v1/auth', authRouter);

  app.use('/api/v1/organizations', organizationsRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/retry-policies', retryPoliciesRouter);
  app.use('/api/v1/queues', queuesRouter);
  app.use('/api/v1/jobs', (req, res, next) => {
    if (req.method === 'POST') {
      return jobIngestionLimiter(req, res, next);
    }
    next();
  }, jobsRouter);
  app.use('/api/v1/dlq', dlqRouter);
  app.use('/api/v1/scheduled-jobs', scheduledJobsRouter);
  app.use('/api/v1/workers', workersRouter);
  app.use('/api/v1/workflows', workflowsRouter);
  app.use('/api/v1/events', eventsRouter);


  // Global 404 Route Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested API endpoint does not exist.',
    });
  });

  // Centralized Error Handling Middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err, 'Unhandled API Error');
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred.',
    });
  });

  return app;
}
