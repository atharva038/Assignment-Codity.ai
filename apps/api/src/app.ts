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

export function createApp(): Express {
  const app = express();

  // Security headers & Cross-Origin Resource Sharing
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // HTTP Request Logging Middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info({ method: req.method, url: req.url }, `Incoming HTTP Request`);
    next();
  });

  // Base Health and Diagnostic Routes
  app.use('/', healthRouter);
  app.use('/api/v1', healthRouter);

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
