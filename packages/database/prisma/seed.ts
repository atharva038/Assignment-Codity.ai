/**
 * ============================================================================
 * Database Seeder — Distributed Job Scheduler
 * ============================================================================
 * Seeds initial demo data:
 * - Admin & Standard Users
 * - Demo Organization & Project
 * - Default Retry Policies (Fixed, Linear, Exponential)
 * - Sample Email, Report, and Webhook Queues
 * - Sample Jobs in QUEUED, COMPLETED, and SCHEDULED states
 */

import dotenv from 'dotenv';
import { PrismaClient, JobStatus, QueueStatus, RetryPolicyType, Role, OrgRole } from '@prisma/client';

dotenv.config({ path: '../../.env' });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Default Retry Policies
  const expPolicy = await prisma.retryPolicy.upsert({
    where: { id: 'policy-exponential-default' },
    update: {},
    create: {
      id: 'policy-exponential-default',
      name: 'Default Exponential Backoff',
      type: RetryPolicyType.EXPONENTIAL,
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      backoffMultiplier: 2.0,
    },
  });

  const fixedPolicy = await prisma.retryPolicy.upsert({
    where: { id: 'policy-fixed-default' },
    update: {},
    create: {
      id: 'policy-fixed-default',
      name: 'Default Fixed Delay (5s)',
      type: RetryPolicyType.FIXED,
      maxAttempts: 5,
      initialDelayMs: 5000,
      maxDelayMs: 5000,
    },
  });

  console.log('✅ Created retry policies');

  // 2. Create Demo User
  const demoUser = await prisma.user.upsert({
    where: { email: 'admin@codity.ai' },
    update: {},
    create: {
      email: 'admin@codity.ai',
      name: 'Admin User',
      passwordHash: '$2b$10$epRmg5i.19v2x1/V7.nO4.b7lUo6iO95M8B6S9Vp6D/4x9x9x9x9x', // demo hash
      role: Role.ADMIN,
    },
  });

  // 3. Create Demo Organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'codity-corp' },
    update: {},
    create: {
      name: 'Codity Corporation',
      slug: 'codity-corp',
      members: {
        create: {
          userId: demoUser.id,
          role: OrgRole.OWNER,
        },
      },
    },
  });

  // 4. Create Demo Project
  const demoProject = await prisma.project.upsert({
    where: {
      organizationId_slug: {
        organizationId: demoOrg.id,
        slug: 'main-platform',
      },
    },
    update: {},
    create: {
      organizationId: demoOrg.id,
      name: 'Main Platform Services',
      slug: 'main-platform',
      description: 'Core production backend queues and scheduled worker pipelines.',
    },
  });

  console.log('✅ Created org & project:', demoOrg.name, '->', demoProject.name);

  // 5. Create Sample Queues
  const emailQueue = await prisma.queue.upsert({
    where: {
      projectId_name: {
        projectId: demoProject.id,
        name: 'email-notifications',
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      name: 'email-notifications',
      priority: 20, // High priority
      concurrencyLimit: 5,
      status: QueueStatus.ACTIVE,
      retryPolicyId: expPolicy.id,
    },
  });

  const reportQueue = await prisma.queue.upsert({
    where: {
      projectId_name: {
        projectId: demoProject.id,
        name: 'report-generation',
      },
    },
    update: {},
    create: {
      projectId: demoProject.id,
      name: 'report-generation',
      priority: 10,
      concurrencyLimit: 2,
      status: QueueStatus.ACTIVE,
      retryPolicyId: fixedPolicy.id,
    },
  });

  console.log('✅ Created sample queues:', emailQueue.name, reportQueue.name);

  // 6. Create Initial Demo Jobs
  await prisma.job.createMany({
    data: [
      {
        queueId: emailQueue.id,
        type: 'email_notification',
        payload: { to: 'user1@example.com', subject: 'Welcome to Codity Scheduler!', template: 'welcome' },
        priority: 20,
        status: JobStatus.QUEUED,
        maxAttempts: 3,
        availableAt: new Date(),
      },
      {
        queueId: emailQueue.id,
        type: 'email_notification',
        payload: { to: 'user2@example.com', subject: 'Password Reset Request', template: 'reset_pass' },
        priority: 30, // Higher priority!
        status: JobStatus.QUEUED,
        maxAttempts: 3,
        availableAt: new Date(),
      },
      {
        queueId: reportQueue.id,
        type: 'report_generation',
        payload: { reportType: 'MONTHLY_SUMMARY', orgId: demoOrg.id, format: 'PDF' },
        priority: 10,
        status: JobStatus.QUEUED,
        maxAttempts: 5,
        availableAt: new Date(),
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seeded initial demo jobs!');

  // 7. Seed Sample Workflow DAG
  const demoWf = await prisma.workflow.create({
    data: {
      projectId: demoProject.id,
      name: 'Data Processing & Executive Summary Pipeline',
      description: 'Automated 4-step fan-out fan-in DAG workflow',
      status: 'RUNNING',
    },
  });

  const jobA = await prisma.job.create({
    data: {
      queueId: reportQueue.id,
      workflowId: demoWf.id,
      type: 'report_generation',
      payload: { reportType: 'raw_telemetry' },
      priority: 30,
      status: JobStatus.QUEUED,
      unresolvedParentCount: 0,
      availableAt: new Date(),
    },
  });

  const jobB = await prisma.job.create({
    data: {
      queueId: emailQueue.id,
      workflowId: demoWf.id,
      type: 'email_notification',
      payload: { to: 'devs@codity.ai', subject: 'Telemetry Ingested' },
      priority: 20,
      status: JobStatus.BLOCKED,
      unresolvedParentCount: 1,
      availableAt: new Date(),
    },
  });

  const jobC = await prisma.job.create({
    data: {
      queueId: emailQueue.id,
      workflowId: demoWf.id,
      type: 'email_notification',
      payload: { to: 'management@codity.ai', subject: 'Raw Data Ready' },
      priority: 20,
      status: JobStatus.BLOCKED,
      unresolvedParentCount: 1,
      availableAt: new Date(),
    },
  });

  const jobD = await prisma.job.create({
    data: {
      queueId: reportQueue.id,
      workflowId: demoWf.id,
      type: 'report_generation',
      payload: { reportType: 'FINAL_EXEC_PDF' },
      priority: 10,
      status: JobStatus.BLOCKED,
      unresolvedParentCount: 2,
      availableAt: new Date(),
    },
  });

  await prisma.jobDependency.createMany({
    data: [
      { parentJobId: jobA.id, childJobId: jobB.id },
      { parentJobId: jobA.id, childJobId: jobC.id },
      { parentJobId: jobB.id, childJobId: jobD.id },
      { parentJobId: jobC.id, childJobId: jobD.id },
    ],
  });

  console.log('✅ Seeded demo workflow DAG:', demoWf.name);
  console.log('🎉 Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
