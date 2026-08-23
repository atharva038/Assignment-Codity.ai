/**
 * ============================================================================
 * Event-Driven Execution Schemas — Distributed Job Scheduler
 * ============================================================================
 * Zod validation schemas for Event Subscriptions, Inbound Event Publishing,
 * Webhooks, and Event Logs.
 */

import { z } from 'zod';

export const EventTriggerTargetEnum = z.enum(['JOB', 'WORKFLOW']);
export type EventTriggerTarget = z.infer<typeof EventTriggerTargetEnum>;

export const EventDeliveryStatusEnum = z.enum(['PROCESSED', 'IGNORED', 'FAILED']);
export type EventDeliveryStatus = z.infer<typeof EventDeliveryStatusEnum>;

export const CreateEventSubscriptionSchema = z.object({
  projectId: z.string().uuid('Valid Project UUID is required'),
  name: z.string().min(1, 'Name is required').max(100),
  eventType: z.string().min(1, 'Event Type is required').max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(true),
  targetType: EventTriggerTargetEnum.default('JOB'),

  // Target = JOB fields
  queueId: z.string().uuid().optional(),
  jobType: z.string().min(1).max(100).optional(),
  jobPayloadTemplate: z.record(z.any()).optional(),

  // Target = WORKFLOW fields (multi-node DAG template)
  workflowTemplate: z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    nodes: z.array(
      z.object({
        key: z.string().min(1),
        queueId: z.string().uuid(),
        type: z.string().min(1),
        payload: z.record(z.any()).optional().default({}),
        priority: z.number().int().min(1).max(100).optional().default(10),
        parents: z.array(z.string()).optional().default([]),
      })
    ).min(1, 'Workflow template must contain at least 1 node'),
  }).optional(),

  // Webhook Security
  secret: z.string().min(8, 'Secret must be at least 8 characters if provided').max(256).optional(),
}).refine(
  (data) => {
    if (data.targetType === 'JOB') {
      return !!data.queueId && !!data.jobType;
    }
    if (data.targetType === 'WORKFLOW') {
      return !!data.workflowTemplate && data.workflowTemplate.nodes.length > 0;
    }
    return true;
  },
  {
    message: 'For JOB target, queueId and jobType are required. For WORKFLOW target, workflowTemplate is required.',
  }
);

export type CreateEventSubscriptionInput = z.infer<typeof CreateEventSubscriptionSchema>;

export const UpdateEventSubscriptionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  eventType: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  targetType: EventTriggerTargetEnum.optional(),
  queueId: z.string().uuid().nullable().optional(),
  jobType: z.string().min(1).max(100).nullable().optional(),
  jobPayloadTemplate: z.record(z.any()).nullable().optional(),
  workflowTemplate: z.any().nullable().optional(),
  secret: z.string().max(256).nullable().optional(),
});

export type UpdateEventSubscriptionInput = z.infer<typeof UpdateEventSubscriptionSchema>;

export const PublishEventSchema = z.object({
  projectId: z.string().uuid('Valid Project UUID is required'),
  eventType: z.string().min(1, 'Event Type is required').max(100),
  payload: z.record(z.any()).default({}),
  idempotencyKey: z.string().max(256).optional(),
  source: z.string().max(50).default('API'),
});

export type PublishEventInput = z.infer<typeof PublishEventSchema>;

export const EventQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  status: EventDeliveryStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type EventQueryInput = z.infer<typeof EventQuerySchema>;
