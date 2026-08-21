/**
 * ============================================================================
 * Retry Policy Management Routes — Distributed Job Scheduler
 * ============================================================================
 * CRUD for creating and listing reusable job retry policies (Fixed, Linear, Exponential).
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@job-scheduler/database';
import { createRetryPolicySchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

export const retryPoliciesRouter = Router();

retryPoliciesRouter.use(authenticateToken);

/**
 * POST /api/v1/retry-policies
 * Creates a reusable retry backoff policy.
 */
retryPoliciesRouter.post('/', validate(createRetryPolicySchema), async (req: Request, res: Response) => {
  const { name, type, maxAttempts, initialDelayMs, maxDelayMs, backoffMultiplier } = req.body;

  const policy = await prisma.retryPolicy.create({
    data: {
      name,
      type,
      maxAttempts,
      initialDelayMs,
      maxDelayMs,
      backoffMultiplier,
    },
  });

  res.status(201).json({ message: 'Retry policy created successfully', retryPolicy: policy });
});

/**
 * GET /api/v1/retry-policies
 * Lists all retry policies available.
 */
retryPoliciesRouter.get('/', async (_req: Request, res: Response) => {
  const retryPolicies = await prisma.retryPolicy.findMany({
    orderBy: { name: 'asc' },
  });

  res.status(200).json({ retryPolicies });
});
