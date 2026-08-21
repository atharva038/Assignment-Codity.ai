/**
 * ============================================================================
 * Authentication Routes — Distributed Job Scheduler
 * ============================================================================
 * Handles user registration, login authentication, password hashing with bcrypt,
 * JWT token generation, and current profile retrieval.
 */

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, Role, OrgRole } from '@job-scheduler/database';
import { registerSchema, loginSchema } from '@job-scheduler/shared';
import { validate } from '../middleware/validate.js';
import { authenticateToken } from '../middleware/auth.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-assignment-jwt-key-2026';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/v1/auth/register
 * Registers a new user and automatically seeds a default organization & project.
 */
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  const { email, password, name, organizationName } = req.body;

  // Check existing user
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: 'Conflict', message: 'User with this email already exists' });
    return;
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Generate unique org slug
  const orgName = organizationName || `${name.split(' ')[0]}'s Org`;
  const baseSlug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const slug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Create User, Organization, Member, and Default Project in an atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: Role.USER,
      },
    });

    const org = await tx.organization.create({
      data: {
        name: orgName,
        slug,
        members: {
          create: {
            userId: user.id,
            role: OrgRole.OWNER,
          },
        },
      },
    });

    const project = await tx.project.create({
      data: {
        organizationId: org.id,
        name: 'Default Project',
        slug: 'default-project',
        description: 'Default project automatically created on registration.',
      },
    });

    return { user, org, project };
  });

  // Issue JWT Token
  const token = jwt.sign(
    { userId: result.user.id, email: result.user.email, role: result.user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    },
    organization: result.org,
    defaultProject: result.project,
  });
});

/**
 * POST /api/v1/auth/login
 * Authenticates user credentials and issues a JWT token.
 */
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password credentials' });
    return;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * GET /api/v1/auth/me
 * Retrieves current authenticated user details and organization memberships.
 */
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
    return;
  }

  res.status(200).json({ user });
});
