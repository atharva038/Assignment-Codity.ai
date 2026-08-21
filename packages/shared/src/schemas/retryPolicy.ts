/**
 * ============================================================================
 * Retry Policy Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 */

import { z } from 'zod';
import { RetryPolicyType } from '../enums/index.js';

export const createRetryPolicySchema = z.object({
  name: z.string().min(2, 'Retry policy name must be at least 2 characters long'),
  type: z.nativeEnum(RetryPolicyType),
  maxAttempts: z.number().int().min(1).max(20).default(3),
  initialDelayMs: z.number().int().min(100).max(86400000).default(1000),
  maxDelayMs: z.number().int().min(100).max(86400000).default(60000),
  backoffMultiplier: z.number().min(1.0).max(10.0).default(2.0),
});

export type CreateRetryPolicyInput = z.infer<typeof createRetryPolicySchema>;
