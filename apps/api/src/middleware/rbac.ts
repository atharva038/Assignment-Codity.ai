/**
 * ============================================================================
 * Role-Based Access Control (RBAC) Middleware — Distributed Job Scheduler
 * ============================================================================
 * Enforces role authorization at both the System Level (ADMIN vs USER)
 * and the Organization Tenant Level (OWNER vs ADMIN vs MEMBER).
 */

import { Request, Response, NextFunction } from 'express';
import { Role, OrgRole, prisma } from '@job-scheduler/database';

/**
 * Middleware factory that restricts route access to specific System Roles (e.g. ADMIN).
 */
export function requireSystemRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of the following system roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware factory that restricts route access to specific Organization Roles (e.g. OWNER or ADMIN).
 */
export function requireOrgRole(allowedOrgRoles: OrgRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token required.',
      });
      return;
    }

    // System ADMINs bypass organization role checks
    if (req.user.role === Role.ADMIN) {
      next();
      return;
    }

    const orgId = req.params.organizationId || req.body.organizationId || (req.query.organizationId as string);

    if (!orgId) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'organizationId is required for role verification.',
      });
      return;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId: req.user.userId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You are not a member of this organization tenant.',
      });
      return;
    }

    if (!allowedOrgRoles.includes(membership.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Action requires one of the following organization roles: [${allowedOrgRoles.join(', ')}]. Your role: ${membership.role}`,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware ensuring the user is either a System ADMIN or an Org OWNER/ADMIN for the target Queue.
 */
export function requireQueueAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    if (req.user.role === Role.ADMIN) {
      next();
      return;
    }

    const queueId = req.params.id;
    if (!queueId) {
      res.status(400).json({ error: 'Bad Request', message: 'Queue ID is required' });
      return;
    }

    const queue = await prisma.queue.findUnique({
      where: { id: queueId },
      include: {
        project: {
          select: { organizationId: true },
        },
      },
    });

    if (!queue) {
      res.status(404).json({ error: 'Not Found', message: 'Queue not found' });
      return;
    }

    const membership = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: queue.project.organizationId,
          userId: req.user.userId,
        },
      },
    });

    if (!membership || (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.ADMIN)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Administrative privileges (OWNER/ADMIN) required to modify or toggle queue.',
      });
      return;
    }

    next();
  };
}
