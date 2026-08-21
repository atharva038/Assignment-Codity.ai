/**
 * ============================================================================
 * Scheduled & Cron Job Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 */

import { z } from 'zod';
import cronParser from 'cron-parser';

export const createScheduledJobSchema = z.object({
  projectId: z.string().uuid('Invalid Project UUID'),
  queueId: z.string().uuid('Invalid Queue UUID'),
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  cronExpression: z
    .string()
    .min(5, 'Cron expression is required')
    .refine((val) => {
      try {
        cronParser.parseExpression(val);
        return true;
      } catch {
        return false;
      }
    }, 'Invalid 5-field cron expression (e.g. "*/5 * * * *")'),
  jobType: z.string().min(1, 'Job type is required'),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().min(1).max(100).default(10),
  enabled: z.boolean().default(true),
});

export const toggleScheduledJobSchema = z.object({
  enabled: z.boolean(),
});

export type CreateScheduledJobInput = z.infer<typeof createScheduledJobSchema>;
export type ToggleScheduledJobInput = z.infer<typeof toggleScheduledJobSchema>;
