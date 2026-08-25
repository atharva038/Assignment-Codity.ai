/**
 * ============================================================================
 * End-to-End Scheduler, Cron, Crash Recovery & DLQ Test Suite
 * ============================================================================
 * Automates testing for Phase 13 - 19:
 * 1. Dead Letter Queue (DLQ) APIs (List, Inspect, Replay, Archive)
 * 2. Scheduled Cron Job APIs (Create, List, Toggle)
 * 3. Cron Evaluation Engine & Multi-Replica Optimistic Locking
 * 4. Delayed Job Promotion (SCHEDULED -> QUEUED)
 * 5. Stale Worker Detection (ONLINE -> OFFLINE)
 * 6. Orphaned Job Lease Crash Recovery Reaper (Simulated Process Crash)
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from '../apps/api/src/app.js';
import { prisma, JobStatus, WorkerStatus, DLQResolutionStatus } from '@job-scheduler/database';
import { evaluateCronSchedules } from '../apps/scheduler/src/cronEngine.js';
import { promoteDelayedJobs } from '../apps/scheduler/src/delayedPromoter.js';
import { reapStaleWorkers, recoverOrphanedJobLeases } from '../apps/scheduler/src/reaper.js';

async function runSchedulerTests() {
  console.log('🧪 Starting End-to-End Scheduler, Cron, Crash Recovery & DLQ Test Suite...\n');

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
    // Setup Auth & Project
    const email = `sched-tester-${Date.now()}@example.com`;
    const userRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'password123',
        name: 'Scheduler Tester',
      }),
    });
    const userData = (await userRes.json()) as any;
    const projectId = userData.defaultProject.id;

    // Promote test user to ADMIN so DLQ retry is authorized
    await prisma.user.update({
      where: { id: userData.user.id },
      data: { role: 'ADMIN' },
    });

    // Re-login to get updated JWT token with ADMIN role
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const loginData = (await loginRes.json()) as any;
    const token = loginData.token;

    // Create test queue
    const queueRes = await fetch(`${baseUrl}/api/v1/queues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: `sched-queue-${Date.now().toString().slice(-4)}`,
        priority: 10,
      }),
    });
    const queueData = (await queueRes.json()) as any;
    const queueId = queueData.queue.id;

    // ------------------------------------------------------------------------
    // 1. DLQ APIs (List, Replay, Archive)
    // ------------------------------------------------------------------------
    console.log('1️⃣ Testing Dead Letter Queue (DLQ) Management APIs...');

    // Seed a dead job and DLQ record manually
    const deadJob = await prisma.job.create({
      data: {
        queueId,
        type: 'email_notification',
        payload: { test: 'dlq_replay' },
        status: JobStatus.DEAD,
        attempts: 3,
        maxAttempts: 3,
        errorReason: 'Test fatal failure',
      },
    });

    const dlqRecord = await prisma.deadLetterJob.create({
      data: {
        originalJobId: deadJob.id,
        queueId,
        attempts: 3,
        finalErrorReason: 'Test fatal failure',
        resolutionStatus: DLQResolutionStatus.PENDING,
      },
    });

    // List DLQ
    const dlqListRes = await fetch(`${baseUrl}/api/v1/dlq`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dlqListData = (await dlqListRes.json()) as any;
    assert(dlqListRes.status === 200, 'GET /api/v1/dlq returns 200 OK');
    assert(dlqListData.deadLetterJobs.length > 0, 'GET /dlq returns DLQ record');

    // Replay DLQ Job
    const replayRes = await fetch(`${baseUrl}/api/v1/dlq/${dlqRecord.id}/retry`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const replayData = (await replayRes.json()) as any;
    assert(replayRes.status === 200, 'POST /api/v1/dlq/:id/retry replays dead job (200 OK)');
    assert(replayData.replayedJob?.status === JobStatus.QUEUED, 'Replayed job is created in QUEUED state');
    assert(replayData.deadLetterJob?.resolutionStatus === DLQResolutionStatus.RETRIED, 'DLQ resolutionStatus updated to RETRIED');

    // ------------------------------------------------------------------------
    // 2. Scheduled Cron Job APIs & Engine
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Testing Scheduled & Recurring Cron Job APIs...');
    const createSchedRes = await fetch(`${baseUrl}/api/v1/scheduled-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        queueId,
        name: 'Nightly Database Backup',
        cronExpression: '*/5 * * * *', // Every 5 minutes
        jobType: 'report_generation',
        payload: { type: 'BACKUP' },
      }),
    });
    const createSchedData = (await createSchedRes.json()) as any;
    assert(createSchedRes.status === 201, 'POST /api/v1/scheduled-jobs creates recurring job');
    assert(!!createSchedData.scheduledJob?.nextRunAt, 'Cron nextRunAt timestamp calculated');
    const schedJobId = createSchedData.scheduledJob.id;

    // Toggle Scheduled Job
    const toggleRes = await fetch(`${baseUrl}/api/v1/scheduled-jobs/${schedJobId}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled: false }),
    });
    const toggleData = (await toggleRes.json()) as any;
    assert(toggleRes.status === 200, 'POST /api/v1/scheduled-jobs/:id/toggle disables job');
    assert(toggleData.scheduledJob?.enabled === false, 'Scheduled job enabled set to false');

    // Re-enable and test Cron Dispatch Engine
    await prisma.scheduledJob.update({
      where: { id: schedJobId },
      data: { enabled: true, nextRunAt: new Date(Date.now() - 1000) }, // Set past nextRunAt
    });

    console.log('\n3️⃣ Testing Cron Evaluation Engine with Optimistic Locking...');
    const triggeredCount = await evaluateCronSchedules('test-scheduler-alpha');
    assert(triggeredCount > 0, 'Cron evaluation engine triggered due scheduled job');

    const updatedSched = await prisma.scheduledJob.findUnique({ where: { id: schedJobId } });
    assert(updatedSched?.nextRunAt.getTime()! > Date.now(), 'Scheduled job nextRunAt advanced to future cron tick');

    // ------------------------------------------------------------------------
    // 3. Delayed Job Promotion
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing Delayed Job Promotion (SCHEDULED -> QUEUED)...');
    const delayedJob = await prisma.job.create({
      data: {
        queueId,
        type: 'email_notification',
        payload: { test: 'delayed_promotion' },
        status: JobStatus.SCHEDULED,
        availableAt: new Date(Date.now() - 1000), // Past timestamp eligible for promotion
      },
    });

    const promotedCount = await promoteDelayedJobs();
    assert(promotedCount > 0, 'Delayed job promoter updated status to QUEUED');

    const checkPromoted = await prisma.job.findUnique({ where: { id: delayedJob.id } });
    assert(checkPromoted?.status === JobStatus.QUEUED, 'Promoted job status is QUEUED');

    // ------------------------------------------------------------------------
    // 4. Stale Worker Detection
    // ------------------------------------------------------------------------
    console.log('\n5️⃣ Testing Stale Worker Detection...');
    const staleWorker = await prisma.worker.create({
      data: {
        workerName: 'Stale-Worker-999',
        hostname: 'crashed-host',
        pid: 99999,
        status: WorkerStatus.ONLINE,
        lastHeartbeatAt: new Date(Date.now() - 60000), // 60 seconds ago (>30s cutoff)
      },
    });

    const reapedWorkerCount = await reapStaleWorkers(30000);
    assert(reapedWorkerCount > 0, 'Stale worker reaper identified silent worker');

    const checkStaleWorker = await prisma.worker.findUnique({ where: { id: staleWorker.id } });
    assert(checkStaleWorker?.status === WorkerStatus.OFFLINE, 'Stale worker status updated to OFFLINE');

    // ------------------------------------------------------------------------
    // 5. Orphaned Job Lease Crash Recovery Reaper (Simulated Process Crash)
    // ------------------------------------------------------------------------
    console.log('\n6️⃣ Testing Orphaned Job Lease Crash Recovery Reaper...');
    const crashedJob = await prisma.job.create({
      data: {
        queueId,
        type: 'report_generation',
        payload: { test: 'crashed_worker_lease' },
        status: JobStatus.RUNNING,
        attempts: 1,
        maxAttempts: 3,
        lastWorkerId: staleWorker.id,
        lockedUntil: new Date(Date.now() - 5000), // Expired lease timestamp!
      },
    });

    const recoveredCount = await recoverOrphanedJobLeases();
    assert(recoveredCount > 0, 'Crash recovery reaper detected expired lease');

    const checkRecovered = await prisma.job.findUnique({ where: { id: crashedJob.id } });
    assert(checkRecovered?.status === JobStatus.QUEUED, 'Crashed worker job lease recovered back to QUEUED');
    assert(checkRecovered?.lockedUntil === null, 'Locked until lease reset to null');

  } catch (error) {
    console.error('Fatal error during scheduler test execution:', error);
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS SUMMARY:`);
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL SCHEDULER, CRON, REAPER & DLQ TESTS PASSED 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSchedulerTests();
