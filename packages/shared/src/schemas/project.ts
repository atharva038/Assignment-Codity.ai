/**
 * ============================================================================
 * Project Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 */

import { z } from 'zod';

export const createProjectSchema = z.object({
  organizationId: z.string().uuid('Invalid Organization UUID'),
  name: z.string().min(2, 'Project name must be at least 2 characters long'),
  slug: z.string().min(2, 'Slug must be at least 2 characters long').regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase alphanumeric characters and hyphens only'),
  description: z.string().max(500).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
