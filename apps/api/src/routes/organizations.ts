/**
 * ============================================================================
 * Organization Management Routes — Distributed Job Scheduler
 * ============================================================================
 * Provides multi-tenant organization creation, listing, and inspection.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma, Role, OrgRole } from '@job-scheduler/database';
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

/**
 * POST /api/v1/organizations/:organizationId/members
 * Admin / Org Owner provisions/invites a new team member directly to their organization.
 */
organizationsRouter.post('/:organizationId/members', requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const { email, name, role = 'MEMBER', password } = req.body;

  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Bad Request', message: 'Valid email is required' });
    return;
  }

  // Check current requester privileges (must be Admin or Org Owner/Admin)
  const currentUserId = req.user!.userId;
  const isGlobalAdmin = req.user!.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const currentMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMember || (currentMember.role !== OrgRole.OWNER && currentMember.role !== OrgRole.ADMIN)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only Organization Admins or Owners can invite and provision new team members.',
      });
      return;
    }
  }

  const assignedOrgRole: OrgRole = role === 'ADMIN' ? OrgRole.ADMIN : OrgRole.MEMBER;
  const assignedGlobalRole: Role = role === 'ADMIN' ? Role.ADMIN : Role.USER;
  const initialPassword = password || 'Welcome2026!';

  // Find or create the user
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
        role: assignedGlobalRole,
      },
    });
  }

  // Check if already a member
  const existingMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
  });

  if (existingMembership) {
    res.status(409).json({
      error: 'Conflict',
      message: 'This user is already a member of this organization.',
    });
    return;
  }

  const membership = await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: user.id,
      role: assignedOrgRole,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  res.status(201).json({
    message: `Team member ${user.email} successfully provisioned as ${assignedOrgRole}.`,
    member: membership,
    temporaryPassword: password ? undefined : initialPassword,
  });
});

/**
 * GET /api/v1/organizations/:organizationId/members
 * Lists all active team members and their RBAC roles under this organization.
 */
organizationsRouter.get('/:organizationId/members', requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId } = req.params;

  const members = await prisma.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.status(200).json({ members });
});

/**
 * PATCH /api/v1/organizations/:organizationId/members/:userId
 * Updates a member's RBAC role within the organization.
 */
organizationsRouter.patch('/:organizationId/members/:userId', requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId, userId } = req.params;
  const { role } = req.body;

  if (!role || !['MEMBER', 'ADMIN', 'OWNER'].includes(role)) {
    res.status(400).json({ error: 'Bad Request', message: 'Valid role (MEMBER, ADMIN, OWNER) is required' });
    return;
  }

  const currentUserId = req.user!.userId;
  const isGlobalAdmin = req.user!.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const currentMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMember || (currentMember.role !== OrgRole.OWNER && currentMember.role !== OrgRole.ADMIN)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only Organization Admins or Owners can modify member permissions.',
      });
      return;
    }
  }

  const updatedMembership = await prisma.organizationMember.update({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    data: {
      role: role as OrgRole,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Also sync global user role if changing to ADMIN
  if (role === 'ADMIN' || role === 'OWNER') {
    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });
  } else if (role === 'MEMBER') {
    await prisma.user.update({
      where: { id: userId },
      data: { role: Role.USER },
    });
  }

  res.status(200).json({
    message: `Updated permissions for ${updatedMembership.user.email} to ${role}`,
    member: updatedMembership,
  });
});

/**
 * DELETE /api/v1/organizations/:organizationId/members/:userId
 * Revokes access and removes a member from the organization.
 */
organizationsRouter.delete('/:organizationId/members/:userId', requireOrgMember(), async (req: Request, res: Response) => {
  const { organizationId, userId } = req.params;
  const currentUserId = req.user!.userId;
  const isGlobalAdmin = req.user!.role === 'ADMIN';

  if (!isGlobalAdmin) {
    const currentMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMember || (currentMember.role !== OrgRole.OWNER && currentMember.role !== OrgRole.ADMIN)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only Organization Admins or Owners can revoke member access.',
      });
      return;
    }
  }

  // Prevent self-deletion if last owner
  if (currentUserId === userId) {
    const ownerCount = await prisma.organizationMember.count({
      where: {
        organizationId,
        role: OrgRole.OWNER,
      },
    });
    if (ownerCount <= 1) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot revoke access from the primary organization owner.',
      });
      return;
    }
  }

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
  });

  res.status(200).json({ message: 'Member access revoked successfully' });
});


