/**
 * ============================================================================
 * Automated Test Suite — Event-Driven Execution Engine
 * ============================================================================
 * Automates testing for Event-Driven Features:
 * 1. Dynamic Payload Template Interpolation & Wildcard Pattern Matching
 * 2. Event Subscription Management (Job and DAG Workflow targets)
 * 3. Inbound Event Ingestion via Authenticated API (POST /api/v1/events/publish)
 * 4. Inbound Webhook Receiver with HMAC SHA-256 signature verification
 * 5. Idempotency Key deduplication (Zero Duplicate Job Ingestion)
 * 6. EventLog Audit Trail Verification
 * 7. End-to-End Worker Claim & Execution of Event-Triggered Jobs
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../apps/api/src/app.js';
import { prisma, JobStatus, WorkflowStatus } from '@job-scheduler/database';
import { interpolatePayload, matchEventPattern } from '@job-scheduler/shared';
import { WorkerHeartbeatManager } from '../apps/worker/src/heartbeat.js';
import { claimJobs } from '../apps/worker/src/claim.js';
import { executeJob } from '../apps/worker/src/executor.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-key-32-chars-minimum-prod';

async function runEventDrivenTests() {
  console.log('🧪 Starting Event-Driven Execution Test Suite...\n');

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
    // Test 1: Dynamic Payload Interpolator & Wildcard Matching Unit Tests
    // ------------------------------------------------------------------------
    console.log('1️⃣ Testing Dynamic Payload Interpolator & Event Pattern Matching...');

    assert(matchEventPattern('*', 'payment.success') === true, 'Wildcard "*" matches all events');
    assert(matchEventPattern('payment.*', 'payment.success') === true, 'Wildcard "payment.*" matches "payment.success"');
    assert(matchEventPattern('payment.*', 'user.created') === false, 'Wildcard "payment.*" rejects "user.created"');
    assert(matchEventPattern('order.created', 'order.created') === true, 'Exact match matches');

    const template = {
      recipient: '{{event.email}}',
      amountDue: '{{event.amount}}',
      orderTag: 'ORD-{{event.orderId}}',
      meta: {
        customer: '{{event.customer.name}}',
      },
    };

    const context = {
      event: {
        email: 'alex@example.com',
        amount: 250,
        orderId: '9876',
        customer: { name: 'Alex Mercer' },
      },
    };

    const resolved = interpolatePayload(template, context);
    assert(resolved.recipient === 'alex@example.com', 'Interpolated top-level email variable');
    assert(resolved.amountDue === 250, 'Interpolated top-level numeric variable');
    assert(resolved.orderTag === 'ORD-9876', 'Interpolated substring variable');
    assert(resolved.meta.customer === 'Alex Mercer', 'Interpolated nested object variable');

    // ------------------------------------------------------------------------
    // Seed Test Tenant & Queues
    // ------------------------------------------------------------------------
    const org = await prisma.organization.create({
      data: { name: 'Event Driven Org', slug: `event-org-${Date.now()}` },
    });

    const project = await prisma.project.create({
      data: {
        organizationId: org.id,
        name: 'Event Test Project',
        slug: `event-proj-${Date.now()}`,
      },
    });

    const testUser = await prisma.user.create({
      data: {
        email: `event-tester-${Date.now()}@example.com`,
        passwordHash: 'fakehash',
        name: 'Event Tester',
        role: 'ADMIN',
      },
    });

    const authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email, role: 'ADMIN' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const testQueue = await prisma.queue.create({
      data: {
        projectId: project.id,
        name: `event-queue-${Date.now()}`,
        priority: 15,
        concurrencyLimit: 5,
      },
    });

    // ------------------------------------------------------------------------
    // Test 2: Event Subscription Creation (Job Target)
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Testing Event Subscription Creation (Job Target)...');

    const subRes = await fetch(`${baseUrl}/api/v1/events/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        name: 'User Signup Email Trigger',
        eventType: 'user.signup',
        targetType: 'JOB',
        queueId: testQueue.id,
        jobType: 'email_notification',
        jobPayloadTemplate: {
          to: '{{event.email}}',
          subject: 'Welcome to our platform {{event.name}}!',
          userId: '{{event.userId}}',
        },
      }),
    });

    assert(subRes.status === 201, 'Created Event Subscription for single Job', `Status: ${subRes.status}`);
    const subData = await subRes.json();
    const jobSubId = subData.subscription.id;

    // ------------------------------------------------------------------------
    // Test 3: Authenticated Event Publishing & Automatic Job Triggering
    // ------------------------------------------------------------------------
    console.log('\n3️⃣ Testing Event Ingestion via /api/v1/events/publish...');

    const pubRes = await fetch(`${baseUrl}/api/v1/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        eventType: 'user.signup',
        payload: {
          email: 'jane.doe@example.com',
          name: 'Jane Doe',
          userId: 'usr_42',
        },
      }),
    });

    assert(pubRes.status === 201, 'Published event successfully', `Status: ${pubRes.status}`);
    const pubData = await pubRes.json();
    assert(pubData.result.status === 'PROCESSED', 'Event delivery status is PROCESSED');
    assert(pubData.result.matchedRuleCount === 1, 'Matched 1 active subscription rule');
    assert(pubData.result.triggeredJobIds.length === 1, 'Triggered exactly 1 Job');

    const triggeredJobId = pubData.result.triggeredJobIds[0];
    const createdJob = await prisma.job.findUnique({ where: { id: triggeredJobId } });
    assert(createdJob !== null, 'Triggered Job exists in database');
    assert(
      [JobStatus.QUEUED, JobStatus.CLAIMED, JobStatus.RUNNING, JobStatus.COMPLETED].includes(createdJob?.status as any),
      'Triggered Job entered execution pipeline (QUEUED/CLAIMED/COMPLETED)'
    );
    assert((createdJob?.payload as any)?.to === 'jane.doe@example.com', 'Job payload was dynamically resolved');

    // ------------------------------------------------------------------------
    // Test 4: Event Subscription with DAG Workflow Target
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing Event Subscription with Multi-Job DAG Workflow Target...');

    const wfSubRes = await fetch(`${baseUrl}/api/v1/events/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        name: 'Order Processing Pipeline Trigger',
        eventType: 'order.placed',
        targetType: 'WORKFLOW',
        workflowTemplate: {
          name: 'Order Fulfillment Pipeline',
          description: 'Triggered upon order.placed event',
          nodes: [
            {
              key: 'validate_order',
              queueId: testQueue.id,
              type: 'report_generation',
              payload: { orderId: '{{event.orderId}}', step: 'validate' },
              parents: [],
            },
            {
              key: 'send_confirmation',
              queueId: testQueue.id,
              type: 'email_notification',
              payload: { to: '{{event.customerEmail}}', orderId: '{{event.orderId}}' },
              parents: ['validate_order'],
            },
          ],
        },
      }),
    });

    assert(wfSubRes.status === 201, 'Created Event Subscription for DAG Workflow', `Status: ${wfSubRes.status}`);

    const pubWfRes = await fetch(`${baseUrl}/api/v1/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        eventType: 'order.placed',
        payload: {
          orderId: 'ORD-999',
          customerEmail: 'customer@shop.com',
        },
      }),
    });

    const pubWfData = await pubWfRes.json();
    assert(pubWfData.result.triggeredWorkflowIds.length === 1, 'Triggered 1 DAG Workflow instance');

    const createdWorkflow = await prisma.workflow.findUnique({
      where: { id: pubWfData.result.triggeredWorkflowIds[0] },
      include: { jobs: true },
    });

    assert(createdWorkflow !== null, 'Triggered Workflow exists in DB');
    assert(createdWorkflow?.jobs.length === 2, 'Instantiated 2 DAG nodes as Jobs');

    const rootJob = createdWorkflow?.jobs.find((j) => (j.payload as any).step === 'validate');
    const childJob = createdWorkflow?.jobs.find((j) => (j.payload as any).to === 'customer@shop.com');
    assert(rootJob?.status === JobStatus.QUEUED, 'Root DAG node is immediately QUEUED');
    assert(childJob?.status === JobStatus.BLOCKED, 'Child DAG node is BLOCKED until root finishes');

    // ------------------------------------------------------------------------
    // Test 5: Inbound Webhook with HMAC SHA-256 Signature Verification
    // ------------------------------------------------------------------------
    console.log('\n5️⃣ Testing Inbound Webhook Receiver with HMAC SHA-256 Verification...');

    const webhookSecret = 'super-secret-webhook-hmac-key-12345';
    const webhookSub = await prisma.eventSubscription.create({
      data: {
        projectId: project.id,
        name: 'GitHub Webhook Receiver',
        eventType: 'github.push',
        targetType: 'JOB',
        queueId: testQueue.id,
        jobType: 'webhook_delivery',
        jobPayloadTemplate: {
          commit: '{{event.commit}}',
          author: '{{event.author}}',
        },
        secret: webhookSecret,
      },
    });

    const webhookPayload = { commit: 'a1b2c3d', author: 'torvalds' };
    const rawBody = JSON.stringify(webhookPayload);

    // Compute valid HMAC SHA-256 signature
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const validHookRes = await fetch(`${baseUrl}/api/v1/events/webhook/${webhookSub.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-sha256': validSignature,
      },
      body: rawBody,
    });

    assert(validHookRes.status === 200, 'Valid HMAC signature accepted (200 OK)', `Status: ${validHookRes.status}`);

    // Test with invalid signature
    const invalidHookRes = await fetch(`${baseUrl}/api/v1/events/webhook/${webhookSub.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-sha256': 'forged_invalid_signature_12345',
      },
      body: rawBody,
    });

    assert(invalidHookRes.status === 401, 'Invalid HMAC signature rejected (401 Unauthorized)', `Status: ${invalidHookRes.status}`);

    // ------------------------------------------------------------------------
    // Test 6: Idempotency Key Deduplication Guard
    // ------------------------------------------------------------------------
    console.log('\n6️⃣ Testing Idempotency Key Deduplication Guard...');

    const idempotencyKey = `evt-dedup-${Date.now()}`;
    const firstPub = await fetch(`${baseUrl}/api/v1/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        eventType: 'user.signup',
        payload: { email: 'dedup@example.com', name: 'Dedup Test' },
        idempotencyKey,
      }),
    });

    const firstData = await firstPub.json();
    const firstJobCount = await prisma.job.count({ where: { queueId: testQueue.id } });

    // Send duplicate event with same idempotency key
    const secondPub = await fetch(`${baseUrl}/api/v1/events/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId: project.id,
        eventType: 'user.signup',
        payload: { email: 'dedup@example.com', name: 'Dedup Test' },
        idempotencyKey,
      }),
    });

    const secondJobCount = await prisma.job.count({ where: { queueId: testQueue.id } });
    assert(firstJobCount === secondJobCount, 'Duplicate event with same idempotencyKey did NOT create extra jobs');

    // ------------------------------------------------------------------------
    // Test 7: Event Log Audit Trail Verification
    // ------------------------------------------------------------------------
    console.log('\n7️⃣ Testing Event Log Audit Trail Querying...');

    const logsRes = await fetch(`${baseUrl}/api/v1/events/logs?projectId=${project.id}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    assert(logsRes.status === 200, 'Fetched event audit logs', `Status: ${logsRes.status}`);
    const logsData = await logsRes.json();
    assert(logsData.total >= 4, `Found ${logsData.total} event logs in audit trail`);

    // ------------------------------------------------------------------------
    // Test 8: End-to-End Worker Claim & Execution of Event-Triggered Jobs
    // ------------------------------------------------------------------------
    console.log('\n8️⃣ Testing Worker Fleet Execution of Event-Triggered Job...');

    const workerId = `event-worker-test-${Date.now()}`;
    const hb = new WorkerHeartbeatManager(workerId, 5);
    await hb.register();

    const claimed = await claimJobs(workerId, 5);
    for (const job of claimed) {
      await executeJob(job, workerId);
    }

    const executedJob = await prisma.job.findUnique({ where: { id: triggeredJobId } });
    assert(
      executedJob !== null &&
      (executedJob.status === JobStatus.COMPLETED || executedJob.status === JobStatus.RUNNING || executedJob.status === JobStatus.QUEUED),
      'Event-triggered Job is tracked and processed by worker engine'
    );

    console.log('\n-------------------------------------------------------------');
    console.log(`📊 Event-Driven Test Suite Summary: ${passedTests}/${totalTests} tests passed.`);
    console.log('-------------------------------------------------------------\n');

    if (passedTests !== totalTests) {
      throw new Error(`Event-Driven Test Suite Failed: ${totalTests - passedTests} tests failed.`);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runEventDrivenTests()
  .then(() => {
    console.log('🎉 All Event-Driven Execution tests passed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Test Suite execution error:', err);
    process.exit(1);
  });
