/**
 * ============================================================================
 * Job Ingestion & Query Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 * Input validation schemas for job creation, batch ingestion, and query filtering.
 */

import { z } from 'zod';
import { JobStatus } from '../enums/index.js';

export const createJobSchema = z.object({
  queueId: z.string().uuid('Invalid Queue UUID'),
  type: z.string().min(1, 'Job type is required'),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().min(1).max(100).default(10),
  availableAt: z.string().datetime().optional().or(z.date().optional()), // Future timestamp for delayed jobs
  maxAttempts: z.number().int().min(1).max(20).default(3),
  timeoutMs: z.number().int().min(1000).max(86400000).default(30000),
  idempotencyKey: z.string().max(255).optional(),
});

export const batchCreateJobSchema = z.object({
  queueId: z.string().uuid('Invalid Queue UUID'),
  jobs: z.array(
    z.object({
      type: z.string().min(1, 'Job type is required'),
      payload: z.record(z.unknown()).default({}),
      priority: z.number().int().min(1).max(100).default(10),
      availableAt: z.string().datetime().optional().or(z.date().optional()),
      maxAttempts: z.number().int().min(1).max(20).default(3),
      idempotencyKey: z.string().max(255).optional(),
    })
  ).min(1, 'At least one job is required in batch').max(100, 'Maximum 100 jobs allowed per batch request'),
});

export const jobQuerySchema = z.object({
  queueId: z.string().uuid('Invalid Queue UUID').optional(),
  status: z.nativeEnum(JobStatus).optional(),
  type: z.string().optional(),
  workerId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type BatchCreateJobInput = z.infer<typeof batchCreateJobSchema>;
export type JobQueryParams = z.infer<typeof jobQuerySchema>;
