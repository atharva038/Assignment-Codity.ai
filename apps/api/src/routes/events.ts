/**
 * ============================================================================
 * Event-Driven Execution API Routes — Distributed Job Scheduler
 * ============================================================================
 * Exposes REST endpoints for:
 *   - Event Subscription CRUD & rule management
 *   - Inbound Event Publishing (authenticated)
 *   - Inbound Webhook Receiver with HMAC SHA-256 validation (public endpoint)
 *   - Event Logs audit streaming & filtering
 *   - Interactive Event Simulation Sandbox
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma, EventDeliveryStatus } from '@job-scheduler/database';
import {
  CreateEventSubscriptionSchema,
  UpdateEventSubscriptionSchema,
  PublishEventSchema,
  EventQuerySchema,
} from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { EventEngine } from '../services/eventEngine.js';
import { getActiveOrgId } from '../middleware/tenant.js';

export const eventsRouter = Router();

// ----------------------------------------------------------------------------
// 1. Inbound Webhook Receiver (PUBLIC ENDPOINT)
// ----------------------------------------------------------------------------
/**
 * POST /api/v1/events/webhook/:subscriptionId
 * Public endpoint for receiving external webhooks (e.g. Stripe, GitHub, Shopify).
 * Verifies HMAC SHA-256 signature if a secret is configured for this subscription.
 */
eventsRouter.post('/webhook/:subscriptionId', async (req: Request, res: Response) => {
  const { subscriptionId } = req.params;

  const subscription = await prisma.eventSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    res.status(404).json({ error: 'Not Found', message: 'Webhook subscription does not exist' });
    return;
  }

  if (!subscription.enabled) {
    res.status(403).json({ error: 'Forbidden', message: 'This webhook subscription is currently disabled' });
    return;
  }

  // Extract signature header (supports standard GitHub/Stripe headers)
  const signatureHeader =
    (req.headers['x-hub-signature-256'] as string) ||
    (req.headers['x-signature-sha256'] as string) ||
    (req.headers['x-webhook-signature'] as string);

  const rawBodyString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const payload = typeof req.body === 'object' && req.body !== null ? req.body : { data: req.body };

  const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

  const result = await EventEngine.dispatchEvent({
    projectId: subscription.projectId,
    eventType: subscription.eventType,
    payload,
    idempotencyKey,
    source: 'WEBHOOK',
    subscriptionId: subscription.id,
    signatureHeader,
    rawBodyString,
  });

  if (result.status === 'FAILED') {
    if (result.errorReason?.includes('HMAC signature')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: result.errorReason,
        result,
      });
      return;
    }

    res.status(500).json({
      error: 'Event Dispatch Failed',
      message: result.errorReason,
      result,
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'Webhook event received and dispatched successfully',
    result,
  });
});

// ----------------------------------------------------------------------------
// Protected Routes (Authentication Required)
// ----------------------------------------------------------------------------
eventsRouter.use(authenticateToken);

/**
 * POST /api/v1/events/publish
 * Authenticated event ingestion endpoint for internal or application events.
 */
eventsRouter.post('/publish', validate(PublishEventSchema), async (req: Request, res: Response) => {
  const { projectId, eventType, payload, idempotencyKey, source } = req.body;

  // Verify Project existence
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Target Project does not exist' });
    return;
  }

  const result = await EventEngine.dispatchEvent({
    projectId,
    eventType,
    payload: payload || {},
    idempotencyKey,
    source: source || 'API',
  });

  if (result.status === 'FAILED') {
    res.status(500).json({
      error: 'Event Dispatch Failed',
      message: result.errorReason,
      result,
    });
    return;
  }

  res.status(201).json({
    success: true,
    message: `Event "${eventType}" ingested successfully`,
    result,
  });
});

/**
 * GET /api/v1/events/subscriptions
 * Lists all event subscriptions, optionally filtered by project or eventType.
 */
eventsRouter.get('/subscriptions', async (req: Request, res: Response) => {
  const { projectId, eventType } = req.query;
  const activeOrgId = getActiveOrgId(req);

  const where: any = {};
  if (projectId) {
    where.projectId = String(projectId);
  } else if (activeOrgId) {
    where.project = { organizationId: activeOrgId };
  }

  if (eventType) where.eventType = String(eventType);

  const subscriptions = await prisma.eventSubscription.findMany({
    where,
    include: {
      project: { select: { id: true, name: true, slug: true } },
      queue: { select: { id: true, name: true, priority: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ subscriptions });
});

/**
 * POST /api/v1/events/subscriptions
 * Creates a new event subscription (mapping an event to a Job or DAG Workflow).
 */
eventsRouter.post('/subscriptions', validate(CreateEventSubscriptionSchema), async (req: Request, res: Response) => {
  const {
    projectId,
    name,
    eventType,
    description,
    enabled = true,
    targetType = 'JOB',
    queueId,
    jobType,
    jobPayloadTemplate,
    workflowTemplate,
    secret,
  } = req.body;

  // Verify Project exists
  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Target Project does not exist' });
    return;
  }

  // If targetType is JOB, verify Queue exists
  if (targetType === 'JOB' && queueId) {
    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
    });
    if (!queue) {
      res.status(404).json({ error: 'Not Found', message: 'Target Queue does not exist' });
      return;
    }
  }

  const subscription = await prisma.eventSubscription.create({
    data: {
      projectId,
      name,
      eventType,
      description,
      enabled,
      targetType,
      queueId: targetType === 'JOB' ? queueId : null,
      jobType: targetType === 'JOB' ? jobType : null,
      jobPayloadTemplate: targetType === 'JOB' ? jobPayloadTemplate : null,
      workflowTemplate: targetType === 'WORKFLOW' ? workflowTemplate : null,
      secret: secret || null,
    },
    include: {
      project: { select: { id: true, name: true } },
      queue: { select: { id: true, name: true } },
    },
  });

  res.status(201).json({
    message: 'Event subscription created successfully',
    subscription,
  });
});

/**
 * PUT /api/v1/events/subscriptions/:id
 * Updates an existing event subscription rule.
 */
eventsRouter.put('/subscriptions/:id', validate(UpdateEventSubscriptionSchema), async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.eventSubscription.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({ error: 'Not Found', message: 'Event subscription does not exist' });
    return;
  }

  const updated = await prisma.eventSubscription.update({
    where: { id },
    data: req.body,
    include: {
      project: { select: { id: true, name: true } },
      queue: { select: { id: true, name: true } },
    },
  });

  res.json({
    message: 'Event subscription updated successfully',
    subscription: updated,
  });
});

/**
 * DELETE /api/v1/events/subscriptions/:id
 * Deletes an event subscription rule.
 */
eventsRouter.delete('/subscriptions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.eventSubscription.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({ error: 'Not Found', message: 'Event subscription does not exist' });
    return;
  }

  await prisma.eventSubscription.delete({
    where: { id },
  });

  res.json({ message: 'Event subscription deleted successfully' });
});

/**
 * GET /api/v1/events/logs
 * Audit stream of recent ingested events.
 */
eventsRouter.get('/logs', validate(EventQuerySchema, 'query'), async (req: Request, res: Response) => {
  const { projectId, eventType, status, limit = 50, offset = 0 } = req.query as any;
  const activeOrgId = getActiveOrgId(req);

  const where: any = {};
  if (projectId) {
    where.projectId = String(projectId);
  } else if (activeOrgId) {
    where.project = { organizationId: activeOrgId };
  }

  if (eventType) where.eventType = String(eventType);
  if (status) where.status = status as EventDeliveryStatus;

  const [total, logs] = await Promise.all([
    prisma.eventLog.count({ where }),
    prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
      include: {
        project: { select: { id: true, name: true } },
      },
    }),
  ]);

  res.json({
    total,
    limit: Number(limit),
    offset: Number(offset),
    logs,
  });
});

/**
 * POST /api/v1/events/simulate
 * Interactive Sandbox simulation endpoint.
 */
eventsRouter.post('/simulate', async (req: Request, res: Response) => {
  const { projectId, eventType, payload } = req.body;

  if (!projectId || !eventType) {
    res.status(400).json({ error: 'Validation Error', message: 'projectId and eventType are required' });
    return;
  }

  const result = await EventEngine.dispatchEvent({
    projectId,
    eventType,
    payload: payload || {},
    source: 'SIMULATION',
  });

  res.json({
    success: true,
    message: `Simulated event "${eventType}" dispatched`,
    result,
  });
});
