/**
 * ============================================================================
 * Multi-Tenant Security Guard Middleware — Distributed Job Scheduler
 * ============================================================================
 * Verifies that the authenticated user is a member of the target Organization
 * before allowing access to projects, queues, or jobs under that organization.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '@job-scheduler/database';

/**
 * Middleware factory requiring user membership in the organization specified
 * by parameter `organizationId` or body field `organizationId`.
 */
export function requireOrgMember() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
      return;
    }

    const orgId = req.params.organizationId || req.body.organizationId || req.query.organizationId;

    if (!orgId || typeof orgId !== 'string') {
      res.status(400).json({ error: 'Bad Request', message: 'Organization ID is required' });
      return;
    }

    // Admins bypass tenant checks
    if (req.user.role === 'ADMIN') {
      next();
      return;
    }

    // Check membership
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
        message: 'You do not have access permissions for this organization tenant.',
      });
      return;
    }

    next();
  };
}

/**
 * Extracts active organization ID from x-organization-id header or query param.
 */
export function getActiveOrgId(req: Request): string | undefined {
  const headerOrgId = req.headers['x-organization-id'];
  if (typeof headerOrgId === 'string' && headerOrgId.trim()) {
    return headerOrgId.trim();
  }
  const queryOrgId = req.query.organizationId;
  if (typeof queryOrgId === 'string' && queryOrgId.trim()) {
    return queryOrgId.trim();
  }
  return undefined;
}
