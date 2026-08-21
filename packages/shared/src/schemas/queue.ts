/**
 * ============================================================================
 * Queue Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 */

import { z } from 'zod';
import { QueueStatus } from '../enums/index.js';

export const createQueueSchema = z.object({
  projectId: z.string().uuid('Invalid Project UUID'),
  name: z.string().min(2, 'Queue name must be at least 2 characters long').regex(/^[a-z0-9-]+$/, 'Queue name must contain lowercase alphanumeric characters and hyphens only'),
  priority: z.number().int().min(1).max(100).default(10),
  concurrencyLimit: z.number().int().min(1).max(100).default(5),
  retryPolicyId: z.string().uuid('Invalid Retry Policy UUID').optional(),
});

export const updateQueueSchema = z.object({
  priority: z.number().int().min(1).max(100).optional(),
  concurrencyLimit: z.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(QueueStatus).optional(),
  retryPolicyId: z.string().uuid('Invalid Retry Policy UUID').nullable().optional(),
});

export type CreateQueueInput = z.infer<typeof createQueueSchema>;
export type UpdateQueueInput = z.infer<typeof updateQueueSchema>;
