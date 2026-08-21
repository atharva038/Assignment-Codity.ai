/**
 * ============================================================================
 * Project Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Provides project CRUD within organizations.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '@job-scheduler/database';
import { createProjectSchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOrgMember } from '../middleware/tenant.js';

export const projectsRouter = Router();

projectsRouter.use(authenticateToken);

/**
 * POST /api/v1/projects
 * Creates a project under an authorized organization.
 */
projectsRouter.post('/', validate(createProjectSchema), requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId, name, slug, description } = req.body;

  const existingProject = await prisma.project.findUnique({
    where: {
      organizationId_slug: {
        organizationId,
        slug,
      },
    },
  });

  if (existingProject) {
    res.status(409).json({ error: 'Conflict', message: 'A project with this slug already exists in the organization' });
    return;
  }

  const project = await prisma.project.create({
    data: {
      organizationId,
      name,
      slug,
      description,
    },
  });

  res.status(201).json({ message: 'Project created successfully', project });
});

/**
 * GET /api/v1/projects
 * Lists projects accessible to the user.
 */
projectsRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { organizationId } = req.query;

  // Find user org memberships
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  const userOrgIds = memberships.map((m) => m.organizationId);

  const whereClause: Record<string, unknown> = {
    organizationId: { in: userOrgIds },
  };

  if (organizationId && typeof organizationId === 'string') {
    whereClause.organizationId = organizationId;
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: { queues: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json({ projects });
});

/**
 * GET /api/v1/projects/:id
 * Retrieves detailed info for a project including queues.
 */
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
      queues: {
        include: {
          retryPolicy: true,
          _count: {
            select: { jobs: true },
          },
        },
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: 'Not Found', message: 'Project not found' });
    return;
  }

  res.status(200).json({ project });
});
