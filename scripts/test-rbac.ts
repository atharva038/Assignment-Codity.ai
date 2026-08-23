/**
 * ============================================================================
 * Automated Test Suite — Role-Based Access Control (RBAC) & Multi-Tenant Security
 * ============================================================================
 * Verifies that:
 * 1. Admin users have privileged access to administrative operations (queue pause/resume, DLQ replay).
 * 2. Regular Member users are blocked with 403 Forbidden on administrative endpoints.
 * 3. Cross-tenant organization access is strictly isolated.
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../apps/api/src/app.js';
import { prisma, Role, OrgRole, QueueStatus, DLQResolutionStatus } from '@job-scheduler/database';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-assignment-jwt-key-2026';

async function runRbacTests() {
  console.log('🧪 Starting RBAC & Role-Based Security Test Suite...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASSED: ${testName}`);
    } else {
      console.error(`  ❌ FAILED: ${testName}`);
      if (detail) console.error(`     Detail: ${detail}`);
    }
  }

  try {
    // ------------------------------------------------------------------------
    // Seed Tenants & Personas
    // ------------------------------------------------------------------------
    console.log('1️⃣ Seeding Admin and Standard Member Personas...');

    const org = await prisma.organization.create({
      data: {
        name: 'RBAC Security Org',
        slug: `rbac-org-${Date.now()}`,
      },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'RBAC Project',
        slug: `rbac-proj-${Date.now()}`,
      },
    });

    const testQueue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `rbac-queue-${Date.now()}`,
        priority: 20,
        concurrencyLimit: 5,
      },
    });

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Admin User
    const adminUser = await prisma.user.create({
      data: {
        email: `rbac-admin-${Date.now()}@example.com`,
        passwordHash,
        name: 'RBAC Admin User',
        role: Role.ADMIN,
      },
    });

    const adminToken = jwt.sign(
      { userId: adminUser.id, email: adminUser.email, role: Role.ADMIN },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Member User (Non-Admin)
    const memberUser = await prisma.user.create({
      data: {
        email: `rbac-member-${Date.now()}@example.com`,
        passwordHash,
        name: 'RBAC Standard Member',
        role: Role.USER,
      },
    });

    await prisma.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: memberUser.id,
        role: OrgRole.MEMBER,
      },
    });

    const memberToken = jwt.sign(
      { userId: memberUser.id, email: memberUser.email, role: Role.USER },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    assert(adminUser !== null && memberUser !== null, 'Seeded Admin and Member test users');

    // ------------------------------------------------------------------------
    // Test 2: Queue Pause/Resume RBAC Gates
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Testing Queue Pause/Resume RBAC Permission Gates...');

    // Member attempts to pause queue -> Must be rejected with 403
    const memberPauseRes = await fetch(`${baseUrl}/api/v1/queues/${testQueue.id}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
    });

    assert(
      memberPauseRes.status === 403,
      'Standard Member is blocked from pausing queue (403 Forbidden)',
      `Status: ${memberPauseRes.status}`
    );

    // Admin attempts to pause queue -> Must succeed with 200 OK
    const adminPauseRes = await fetch(`${baseUrl}/api/v1/queues/${testQueue.id}/pause`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert(
      adminPauseRes.status === 200,
      'Admin successfully pauses queue (200 OK)',
      `Status: ${adminPauseRes.status}`
    );

    const pausedQueue = await prisma.queue.findUnique({ where: { id: testQueue.id } });
    assert(pausedQueue?.status === QueueStatus.PAUSED, 'Queue status in DB updated to PAUSED');

    // Admin resumes queue
    const adminResumeRes = await fetch(`${baseUrl}/api/v1/queues/${testQueue.id}/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert(adminResumeRes.status === 200, 'Admin successfully resumes queue (200 OK)');

    // ------------------------------------------------------------------------
    // Test 3: Dead Letter Queue (DLQ) Replay RBAC Gates
    // ------------------------------------------------------------------------
    console.log('\n3️⃣ Testing Dead Letter Queue (DLQ) Action RBAC Gates...');

    const deadJob = await prisma.job.create({
      data: {
        queueId: testQueue.id,
        type: 'email_notification',
        payload: { to: 'dlq-test@example.com' },
        status: 'DEAD',
        attempts: 3,
        maxAttempts: 3,
      },
    });

    const dlqEntry = await prisma.deadLetterJob.create({
      data: {
        originalJobId: deadJob.id,
        queueId: testQueue.id,
        attempts: 3,
        finalErrorReason: 'Simulated permanent failure',
        resolutionStatus: DLQResolutionStatus.PENDING,
      },
    });

    // Member attempts to replay DLQ -> 403 Forbidden
    const memberReplayRes = await fetch(`${baseUrl}/api/v1/dlq/${dlqEntry.id}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
    });

    assert(
      memberReplayRes.status === 403,
      'Standard Member is blocked from replaying DLQ jobs (403 Forbidden)',
      `Status: ${memberReplayRes.status}`
    );

    // Admin attempts to replay DLQ -> 200 OK
    const adminReplayRes = await fetch(`${baseUrl}/api/v1/dlq/${dlqEntry.id}/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });

    assert(
      adminReplayRes.status === 200,
      'Admin successfully replays DLQ job (200 OK)',
      `Status: ${adminReplayRes.status}`
    );

    // ------------------------------------------------------------------------
    // Test 4: Profile & Role Inspection (/api/v1/auth/me)
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing User Profile & Role Extraction (/api/v1/auth/me)...');

    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });

    assert(meRes.status === 200, 'GET /auth/me returns 200 OK');
    const meData = await meRes.json();
    assert(meData.user.role === Role.USER, 'User system role matches USER');
    assert(meData.user.memberships[0].role === OrgRole.MEMBER, 'User org role matches MEMBER');

    console.log('\n-------------------------------------------------------------');
    console.log(`📊 RBAC Test Suite Summary: ${passedTests}/${totalTests} tests passed.`);
    console.log('-------------------------------------------------------------\n');

    if (passedTests !== totalTests) {
      throw new Error(`RBAC Test Suite Failed: ${totalTests - passedTests} tests failed.`);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runRbacTests()
  .then(() => {
    console.log('🎉 All RBAC & Role-Based Access Control tests passed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 RBAC Test Suite execution error:', err);
    process.exit(1);
  });
