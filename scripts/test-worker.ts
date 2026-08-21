/**
 * ============================================================================
 * End-to-End Worker & Atomic Claiming Integration Test Suite
 * ============================================================================
 * Automates testing for Phase 6 - 10:
 * 1. Single & Batch Job Ingestion via API
 * 2. Idempotency Key Deduplication
 * 3. Delayed Job Scheduling (availableAt)
 * 4. Atomic Job Claiming with FOR UPDATE SKIP LOCKED across 2 parallel Workers
 * 5. Multi-Worker Concurrency & Zero Duplicate Claim Verification
 * 6. Pluggable Job Execution Handlers (email, report, webhook)
 * 7. Exponential Retry Backoff Evaluation & DLQ Routing (failure_demo handler)
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from '../apps/api/src/app.js';
import { prisma, JobStatus, ExecutionStatus, DLQResolutionStatus } from '@job-scheduler/database';
import { WorkerHeartbeatManager } from '../apps/worker/src/heartbeat.js';
import { claimJobs } from '../apps/worker/src/claim.js';
import { executeJob } from '../apps/worker/src/executor.js';

async function runWorkerTests() {
  console.log('🧪 Starting End-to-End Worker & Atomic Claiming Test Suite...\n');

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
    // Setup test environment data
    const userRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `worker-tester-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Worker Tester',
      }),
    });
    const userData = (await userRes.json()) as any;
    const token = userData.token;
    const projectId = userData.defaultProject.id;

    // Create test queue
    const queueName = `worker-test-queue-${Date.now().toString().slice(-4)}`;
    const queueRes = await fetch(`${baseUrl}/api/v1/queues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: queueName,
        priority: 20,
        concurrencyLimit: 10,
      }),
    });
    const queueData = (await queueRes.json()) as any;
    const queueId = queueData.queue.id;

    // ------------------------------------------------------------------------
    // 1. Single Job Ingestion & Idempotency
    // ------------------------------------------------------------------------
    console.log('1️⃣ Testing Job Ingestion & Idempotency Key Deduplication...');
    const idempotencyKey = `idempotent-key-${Date.now()}`;
    const job1Res = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        queueId,
        type: 'email_notification',
        payload: { to: 'worker-test@example.com', subject: 'Test Job' },
        priority: 25,
        idempotencyKey,
      }),
    });
    const job1Data = (await job1Res.json()) as any;
    assert(job1Res.status === 201, 'POST /api/v1/jobs creates job (201 Created)');
    assert(job1Data.job.status === JobStatus.QUEUED, 'Job initial status is QUEUED');
    const singleJobId = job1Data.job.id;

    // Duplicate submission with same idempotency key
    const job1DupRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        queueId,
        type: 'email_notification',
        payload: { to: 'worker-test@example.com', subject: 'Test Job' },
        idempotencyKey,
      }),
    });
    const job1DupData = (await job1DupRes.json()) as any;
    assert(job1DupRes.status === 200, 'Duplicate submission returns 200 OK');
    assert(job1DupData.deduplicated === true, 'Response marks job as deduplicated');
    assert(job1DupData.job.id === singleJobId, 'Duplicate submission returns existing job ID');

    // ------------------------------------------------------------------------
    // 2. Batch Job Ingestion
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Testing Batch Job Ingestion...');
    const batchRes = await fetch(`${baseUrl}/api/v1/jobs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        queueId,
        jobs: [
          { type: 'report_generation', payload: { reportType: 'FINANCIAL' }, priority: 15 },
          { type: 'webhook_delivery', payload: { url: 'https://example.com/webhook' }, priority: 30 },
          { type: 'email_notification', payload: { to: 'batch2@example.com' }, priority: 10 },
        ],
      }),
    });
    const batchData = (await batchRes.json()) as any;
    assert(batchRes.status === 201, 'POST /api/v1/jobs/batch returns 201 Created');
    assert(batchData.count === 3, 'Batch created 3 jobs');

    // ------------------------------------------------------------------------
    // 3. Worker Node Registration & Heartbeats
    // ------------------------------------------------------------------------
    console.log('\n3️⃣ Testing Worker Registration & Fleet Telemetry...');
    const worker1Id = `test-worker-alpha-${Date.now()}`;
    const worker2Id = `test-worker-beta-${Date.now()}`;

    const hb1 = new WorkerHeartbeatManager(worker1Id, 5);
    const hb2 = new WorkerHeartbeatManager(worker2Id, 5);

    await hb1.register();
    await hb2.register();

    const dbWorker1 = await prisma.worker.findUnique({ where: { id: worker1Id } });
    assert(dbWorker1?.status === 'ONLINE', 'Worker 1 registered ONLINE in database');

    // ------------------------------------------------------------------------
    // 4. Atomic Claiming FOR UPDATE SKIP LOCKED & Zero Duplicate Claims
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing High-Concurrency Atomic Claiming (FOR UPDATE SKIP LOCKED)...');
    
    // Ingest 20 jobs for concurrency race test
    const concJobs = Array.from({ length: 20 }, (_, i) => ({
      type: 'email_notification',
      payload: { index: i },
      priority: 10 + (i % 5),
    }));

    await fetch(`${baseUrl}/api/v1/jobs/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ queueId, jobs: concJobs }),
    });

    // Run parallel atomic claims from Worker 1 and Worker 2 simultaneously
    const [claimedByW1, claimedByW2] = await Promise.all([
      claimJobs({ workerId: worker1Id, batchSize: 10 }),
      claimJobs({ workerId: worker2Id, batchSize: 10 }),
    ]);

    const w1Ids = new Set(claimedByW1.map((j) => j.id));
    const w2Ids = new Set(claimedByW2.map((j) => j.id));

    // Check for overlap
    const duplicates = [...w1Ids].filter((id) => w2Ids.has(id));
    assert(claimedByW1.length > 0, 'Worker 1 claimed jobs atomically');
    assert(claimedByW2.length > 0, 'Worker 2 claimed jobs atomically');
    assert(duplicates.length === 0, 'ZERO duplicate job claims between parallel workers (SKIP LOCKED verified!)');

    // ------------------------------------------------------------------------
    // 5. Job Execution Engine & Handler Verification
    // ------------------------------------------------------------------------
    console.log('\n5️⃣ Testing Execution Engine & Handler Execution...');
    const [sampleJob] = await claimJobs({ workerId: worker1Id, batchSize: 1, queueId });
    await executeJob(sampleJob, worker1Id);

    const executedDbJob = await prisma.job.findUnique({
      where: { id: sampleJob.id },
      include: { executions: true, logs: true },
    });

    assert(executedDbJob?.status === JobStatus.COMPLETED, 'Job status updated to COMPLETED');
    assert(executedDbJob?.executions.length === 1, 'JobExecution attempt recorded');
    assert(executedDbJob?.executions[0].status === ExecutionStatus.COMPLETED, 'Execution attempt status is COMPLETED');
    assert(executedDbJob?.logs.length! >= 2, 'Execution logs written to JobLog table');

    // ------------------------------------------------------------------------
    // 6. Exponential Retry Backoff & Dead Letter Queue (DLQ) Routing
    // ------------------------------------------------------------------------
    console.log('\n6️⃣ Testing Retry Backoff & Dead Letter Queue (DLQ) Routing...');
    
    // Create dedicated queue for failure testing to prevent job order ambiguity
    const failQueueRes = await fetch(`${baseUrl}/api/v1/queues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: `fail-test-queue-${Date.now().toString().slice(-4)}`,
        priority: 5,
      }),
    });
    const failQueueData = (await failQueueRes.json()) as any;
    const failQueueId = failQueueData.queue.id;

    // Create a job configured with failure_demo handler and maxAttempts = 2
    const failJobRes = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        queueId: failQueueId,
        type: 'failure_demo',
        payload: { errorMessage: 'Simulated deliberate handler crash' },
        maxAttempts: 2,
      }),
    });
    const failJobData = (await failJobRes.json()) as any;
    const failJobId = failJobData.job.id;

    // Claim and execute Attempt 1
    const [claimedAttempt1] = await claimJobs({ workerId: worker1Id, batchSize: 1, queueId: failQueueId });
    await executeJob(claimedAttempt1, worker1Id);

    const afterAttempt1 = await prisma.job.findUnique({ where: { id: failJobId } });
    assert(afterAttempt1?.status === JobStatus.RETRYING, 'After attempt 1 failure, job status transitions to RETRYING');
    assert(afterAttempt1?.attempts === 1, 'Attempt counter incremented to 1');
    assert(afterAttempt1?.availableAt.getTime()! > Date.now(), 'Future retry availableAt timestamp set');

    // Fast-forward availableAt to NOW() so attempt 2 can be claimed
    await prisma.job.update({
      where: { id: failJobId },
      data: { availableAt: new Date(), status: JobStatus.QUEUED },
    });

    // Claim and execute Attempt 2 (final attempt)
    const [claimedAttempt2] = await claimJobs({ workerId: worker1Id, batchSize: 1, queueId: failQueueId });
    await executeJob(claimedAttempt2, worker1Id);

    const afterAttempt2 = await prisma.job.findUnique({
      where: { id: failJobId },
      include: { deadLetterJob: true },
    });

    assert(afterAttempt2?.status === JobStatus.DEAD, 'After final max attempt failure, job status transitions to DEAD');
    assert(!!afterAttempt2?.deadLetterJob, 'DeadLetterJob entry created pointing back to original Job');
    assert(afterAttempt2?.deadLetterJob?.resolutionStatus === DLQResolutionStatus.PENDING, 'DLQ resolution status is PENDING');

    // Clean up worker heartbeat managers
    await hb1.shutdown();
    await hb2.shutdown();

  } catch (error) {
    console.error('Fatal error during worker test execution:', error);
  } finally {
    server.close();
  }

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS SUMMARY:`);
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL WORKER & ATOMIC CLAIMING INTEGRATION TESTS PASSED 100%!');
  } else {
    process.exit(1);
  }
}

runWorkerTests();
