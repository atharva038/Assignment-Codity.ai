/**
 * ============================================================================
 * Organization Zod Schemas — Distributed Job Scheduler
 * ============================================================================
 */

import { z } from 'zod';

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters long'),
  slug: z.string().min(2, 'Slug must be at least 2 characters long').regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase alphanumeric characters and hyphens only'),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
