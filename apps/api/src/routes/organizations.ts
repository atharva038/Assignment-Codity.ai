/**
 * ============================================================================
 * Organization Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Provides multi-tenant organization creation, listing, and inspection.
 */

import { Router, Request, Response } from 'express';
import { prisma, OrgRole } from '@job-scheduler/database';
import { createOrganizationSchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOrgMember } from '../middleware/tenant.js';

export const organizationsRouter = Router();

// Protect all organization routes with JWT auth
organizationsRouter.use(authenticateToken);

/**
 * POST /api/v1/organizations
 * Creates a new organization and grants current user OWNER role.
 */
organizationsRouter.post('/', validate(createOrganizationSchema), async (req: Request, res: Response) => {
  const { name, slug } = req.body;
  const userId = req.user!.userId;

  const existingOrg = await prisma.organization.findUnique({ where: { slug } });
  if (existingOrg) {
    res.status(409).json({ error: 'Conflict', message: 'An organization with this slug already exists' });
    return;
  }

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      members: {
        create: {
          userId,
          role: OrgRole.OWNER,
        },
      },
    },
    include: {
      members: true,
    },
  });

  res.status(201).json({ message: 'Organization created successfully', organization });
});

/**
 * GET /api/v1/organizations
 * Lists all organizations the authenticated user belongs to.
 */
organizationsRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    include: {
      organization: {
        include: {
          _count: {
            select: {
              projects: true,
              members: true,
            },
          },
        },
      },
    },
  });

  const organizations = memberships.map((m) => ({
    ...m.organization,
    userRole: m.role,
  }));

  res.status(200).json({ organizations });
});

/**
 * GET /api/v1/organizations/:organizationId
 * Retrieves detailed info for an organization (with project & member counts).
 */
organizationsRouter.get('/:organizationId', requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
      projects: true,
    },
  });

  if (!organization) {
    res.status(404).json({ error: 'Not Found', message: 'Organization not found' });
    return;
  }

  res.status(200).json({ organization });
});
