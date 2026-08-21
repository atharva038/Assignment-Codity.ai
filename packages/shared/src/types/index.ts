/**
 * ============================================================================
 * Shared Interfaces & DTO Types — Distributed Job Scheduler
 * ============================================================================
 */

import { JobStatus, QueueStatus, WorkerStatus, LogLevel } from '../enums/index.js';

export interface CreateJobInput {
  queueId: string;
  type: string;
  payload: Record<string, unknown>;
  priority?: number;
  scheduledAt?: string | Date;
  maxAttempts?: number;
  timeoutMs?: number;
  idempotencyKey?: string;
}

export interface BatchCreateJobInput {
  queueId: string;
  jobs: Array<{
    type: string;
    payload: Record<string, unknown>;
    priority?: number;
    scheduledAt?: string | Date;
    maxAttempts?: number;
    idempotencyKey?: string;
  }>;
}

export interface CreateQueueInput {
  projectId: string;
  name: string;
  priority?: number;
  concurrencyLimit?: number;
  retryPolicy?: {
    type: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  };
}

export interface JobFilterParams {
  queueId?: string;
  status?: JobStatus;
  type?: string;
  workerId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface SystemMetricsSummary {
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  deadJobs: number;
  activeWorkers: number;
  successRatePercentage: number;
  averageExecutionTimeMs: number;
}
