/**
 * ============================================================================
 * Workflow Request Validation Schemas — Distributed Job Scheduler
 * ============================================================================
 * Zod schemas for validating workflow creation and query payloads.
 */

import { z } from 'zod';
import { WorkflowStatus } from '../enums/index.js';

export const WorkflowNodeSchema = z.object({
  key: z.string().min(1, 'Node key is required'),
  queueId: z.string().uuid('Invalid queue ID format'),
  type: z.string().min(1, 'Job type is required'),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().min(1).max(100).default(10),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  timeoutMs: z.number().int().min(1000).max(600000).default(30000),
  parents: z.array(z.string()).default([]), // List of parent node keys this node depends on
});

export const CreateWorkflowSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  name: z.string().min(1, 'Workflow name is required').max(100),
  description: z.string().max(500).optional(),
  nodes: z.array(WorkflowNodeSchema).min(1, 'Workflow must contain at least one node'),
});

export const WorkflowQuerySchema = z.object({
  projectId: z.string().uuid('Invalid project ID format').optional(),
  status: z.nativeEnum(WorkflowStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type WorkflowQueryInput = z.infer<typeof WorkflowQuerySchema>;
export type WorkflowNodeInput = z.infer<typeof WorkflowNodeSchema>;
