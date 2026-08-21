/**
 * ============================================================================
 * JWT Authentication Middleware — Distributed Job Scheduler
 * ============================================================================
 * Extracts and verifies Bearer JWT token from `Authorization` header.
 * Attaches authenticated user payload (id, email, role) to Express `req.user`.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@job-scheduler/database';

export interface AuthenticatedUserPayload {
  userId: string;
  email: string;
  role: Role;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-assignment-jwt-key-2026';

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token required. Please provide a valid Bearer token in the Authorization header.',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired access token.',
    });
  }
}
