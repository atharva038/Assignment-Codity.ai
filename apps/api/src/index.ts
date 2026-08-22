/**
 * ============================================================================
 * Express API Server Entrypoint — Distributed Job Scheduler
 * ============================================================================
 * Initializes and starts the Express server with graceful shutdown handlers.
 */

import dotenv from 'dotenv';
import { createApp } from './app.js';
import { logger } from '@job-scheduler/logger';
import { initWsManager } from './ws/WsManager.js';
import { startStatsEmitter } from './ws/statsEmitter.js';

import path from 'node:path';
import fs from 'node:fs';

// Resolve .env from current directory or monorepo root
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../.env'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const PORT = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  logger.info(`🚀 API Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  
  // Initialize WebSocket server attached to HTTP server
  initWsManager(server);
  
  // Start 2s stats pulse loop for connected WebSocket subscribers
  startStatsEmitter(2000);
});


// Graceful process termination handlers
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down API server gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
