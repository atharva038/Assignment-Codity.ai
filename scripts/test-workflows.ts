/**
 * ============================================================================
 * Automated Test Suite — Workflow Dependencies & DAG Engine
 * ============================================================================
 * Automates testing for Workflow DAG Features:
 * 1. Cycle Detection & Topological Validation via Kahn's Algorithm
 * 2. Sequential Workflow DAG Dependency Resolution (A -> B -> C)
 * 3. Fan-out / Fan-in Parallel Workflow Resolution (A -> (B, C) -> D)
 * 4. Cascading Parent Failure & Downstream Child Job Cancellation
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { createApp } from '../apps/api/src/app.js';
import { prisma, JobStatus, WorkflowStatus } from '@job-scheduler/database';
import { validateWorkflowDag } from '@job-scheduler/shared';
import { WorkerHeartbeatManager } from '../apps/worker/src/heartbeat.js';
import { claimJobs } from '../apps/worker/src/claim.js';
import { executeJob } from '../apps/worker/src/executor.js';

async function runWorkflowTests() {
  console.log('🧪 Starting Workflow Dependencies & DAG Engine Test Suite...\n');

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
    // Test 1: Kahn's Algorithm DAG Cycle Detection Unit Test
    // ------------------------------------------------------------------------
    console.log('1️⃣ Testing Kahn\'s Algorithm DAG Cycle Detection...');
    const validDag = validateWorkflowDag(['A', 'B', 'C'], [
      { parent: 'A', child: 'B' },
      { parent: 'B', child: 'C' },
    ]);
    assert(validDag.isValid === true, 'Valid acyclic DAG accepted', `Error: ${validDag.error}`);

    const cyclicDag = validateWorkflowDag(['A', 'B', 'C'], [
      { parent: 'A', child: 'B' },
      { parent: 'B', child: 'C' },
      { parent: 'C', child: 'A' },
    ]);
    assert(cyclicDag.isValid === false, 'Cyclic DAG (A->B->C->A) correctly rejected');

    // ------------------------------------------------------------------------
    // Environment Setup (User, Org, Project, Queue, Worker)
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Setting up Test User & Worker Environment...');
    const workerId = `test-worker-wf-${Date.now()}`;
    const heartbeatManager = new WorkerHeartbeatManager(workerId, 10);
    await heartbeatManager.register();
    const userRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `workflow-tester-${Date.now()}@example.com`,
        password: 'password123',
        name: 'Workflow Tester',
      }),
    });
    const userData = (await userRes.json()) as any;
    const token = userData.token;

    const orgRes = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Workflow Org',
        slug: `workflow-org-${Date.now()}`,
      }),
    });
    const orgData = (await orgRes.json()) as any;

    const projectRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: orgData.organization.id,
        name: 'Workflow Project',
        slug: `wf-proj-${Date.now()}`,
      }),
    });
    const projectData = (await projectRes.json()) as any;
    const projectId = projectData.project.id;

    const queueRes = await fetch(`${baseUrl}/api/v1/queues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: 'workflow-queue',
        priority: 10,
        concurrencyLimit: 5,
      }),
    });
    const queueData = (await queueRes.json()) as any;
    const queueId = queueData.queue.id;

    // ------------------------------------------------------------------------
    // Test 2: Sequential Workflow DAG (Step A -> Step B -> Step C)
    // ------------------------------------------------------------------------
    console.log('\n3️⃣ Testing Sequential Workflow (Step A -> Step B -> Step C)...');
    const seqWfRes = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: 'Sequential Data Pipeline',
        nodes: [
          { key: 'step_a', queueId, type: 'email_notification', payload: { to: 'stepa@example.com', subject: 'Step A' }, parents: [] },
          { key: 'step_b', queueId, type: 'report_generation', payload: { reportType: 'summary' }, parents: ['step_a'] },
          { key: 'step_c', queueId, type: 'webhook_delivery', payload: { url: 'https://example.com/hook' }, parents: ['step_b'] },
        ],
      }),
    });

    const seqWfData = (await seqWfRes.json()) as any;
    assert(seqWfRes.status === 201, 'Sequential Workflow created via API (HTTP 201)');

    const seqWfId = seqWfData.workflow.id;
    const jobAId = seqWfData.nodes.find((n: any) => n.key === 'step_a').job.id;
    const jobBId = seqWfData.nodes.find((n: any) => n.key === 'step_b').job.id;
    const jobCId = seqWfData.nodes.find((n: any) => n.key === 'step_c').job.id;

    let dbJobA = await prisma.job.findUnique({ where: { id: jobAId } });
    let dbJobB = await prisma.job.findUnique({ where: { id: jobBId } });
    let dbJobC = await prisma.job.findUnique({ where: { id: jobCId } });

    assert(dbJobA?.status === JobStatus.QUEUED, 'Root Step A is QUEUED');
    assert(dbJobB?.status === JobStatus.BLOCKED, 'Child Step B is initial BLOCKED');
    assert(dbJobC?.status === JobStatus.BLOCKED, 'Child Step C is initial BLOCKED');

    // Execute Step A
    console.log('   Running Step A...');
    const claimedA = await claimJobs({ workerId: workerId, batchSize: 10, queueId });
    const targetA = claimedA.find((j) => j.id === jobAId);
    assert(!!targetA, 'Worker claimed Root Step A');
    if (targetA) {
      await executeJob(targetA, workerId);
    }

    dbJobA = await prisma.job.findUnique({ where: { id: jobAId } });
    dbJobB = await prisma.job.findUnique({ where: { id: jobBId } });
    assert(dbJobA?.status === JobStatus.COMPLETED, 'Step A completed');
    assert(dbJobB?.status === JobStatus.QUEUED, 'Step B automatically promoted from BLOCKED -> QUEUED when Step A finished');

    // Execute Step B
    console.log('   Running Step B...');
    const claimedB = await claimJobs({ workerId: workerId, batchSize: 10, queueId });
    const targetB = claimedB.find((j) => j.id === jobBId);
    assert(!!targetB, 'Worker claimed Step B');
    if (targetB) {
      await executeJob(targetB, workerId);
    }

    dbJobB = await prisma.job.findUnique({ where: { id: jobBId } });
    dbJobC = await prisma.job.findUnique({ where: { id: jobCId } });
    assert(dbJobB?.status === JobStatus.COMPLETED, 'Step B completed');
    assert(dbJobC?.status === JobStatus.QUEUED, 'Step C automatically promoted from BLOCKED -> QUEUED when Step B finished');

    // Execute Step C
    console.log('   Running Step C...');
    const claimedC = await claimJobs({ workerId: workerId, batchSize: 10, queueId });
    const targetC = claimedC.find((j) => j.id === jobCId);
    assert(!!targetC, 'Worker claimed Step C');
    if (targetC) {
      await executeJob(targetC, workerId);
    }

    const finalSeqWf = await prisma.workflow.findUnique({ where: { id: seqWfId } });
    assert(finalSeqWf?.status === WorkflowStatus.COMPLETED, 'Sequential Workflow overall status is COMPLETED');

    // ------------------------------------------------------------------------
    // Test 3: Fan-Out / Fan-In Workflow (A -> (B, C) -> D)
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing Fan-Out / Fan-In Workflow (A -> (B, C) -> D)...');
    const fanWfRes = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: 'Fan-Out Fan-In Analytics Pipeline',
        nodes: [
          { key: 'root_a', queueId, type: 'report_generation', payload: { reportType: 'raw' }, parents: [] },
          { key: 'branch_b', queueId, type: 'email_notification', payload: { to: 'branchb@example.com' }, parents: ['root_a'] },
          { key: 'branch_c', queueId, type: 'webhook_delivery', payload: { url: 'https://example.com/branchc' }, parents: ['root_a'] },
          { key: 'join_d', queueId, type: 'report_generation', payload: { reportType: 'final' }, parents: ['branch_b', 'branch_c'] },
        ],
      }),
    });

    const fanWfData = (await fanWfRes.json()) as any;
    assert(fanWfRes.status === 201, 'Fan-out / Fan-in Workflow created');

    const fanWfId = fanWfData.workflow.id;
    const fanA = fanWfData.nodes.find((n: any) => n.key === 'root_a').job.id;
    const fanB = fanWfData.nodes.find((n: any) => n.key === 'branch_b').job.id;
    const fanC = fanWfData.nodes.find((n: any) => n.key === 'branch_c').job.id;
    const fanD = fanWfData.nodes.find((n: any) => n.key === 'join_d').job.id;

    // Execute root A
    const claimedFanA = await claimJobs({ workerId: workerId, batchSize: 10, queueId });
    const targetFanA = claimedFanA.find((j) => j.id === fanA);
    if (targetFanA) await executeJob(targetFanA, workerId);

    let dbFanB = await prisma.job.findUnique({ where: { id: fanB } });
    let dbFanC = await prisma.job.findUnique({ where: { id: fanC } });
    let dbFanD = await prisma.job.findUnique({ where: { id: fanD } });

    assert(dbFanB?.status === JobStatus.QUEUED, 'Branch B promoted to QUEUED after Root A finished');
    assert(dbFanC?.status === JobStatus.QUEUED, 'Branch C promoted to QUEUED after Root A finished');
    assert(dbFanD?.status === JobStatus.BLOCKED, 'Join D remains BLOCKED waiting for both B and C');

    // Execute Branch B (using batchSize: 1 so Branch C is not claimed prematurely)
    const claimedFanB = await claimJobs({ workerId: workerId, batchSize: 1, queueId });
    const targetFanB = claimedFanB.find((j) => j.id === fanB);
    if (targetFanB) await executeJob(targetFanB, workerId);

    dbFanD = await prisma.job.findUnique({ where: { id: fanD } });
    assert(dbFanD?.status === JobStatus.BLOCKED, 'Join D stays BLOCKED after only Branch B completes (Branch C pending)');

    // Execute Branch C
    const claimedFanC = await claimJobs({ workerId: workerId, batchSize: 1, queueId });
    const targetFanC = claimedFanC.find((j) => j.id === fanC);
    if (targetFanC) await executeJob(targetFanC, workerId);

    dbFanD = await prisma.job.findUnique({ where: { id: fanD } });
    assert(dbFanD?.status === JobStatus.QUEUED, 'Join D promoted to QUEUED once BOTH Branch B and Branch C completed');

    // Execute Join D
    const claimedFanD = await claimJobs({ workerId: workerId, batchSize: 1, queueId });
    const targetFanD = claimedFanD.find((j) => j.id === fanD);
    if (targetFanD) await executeJob(targetFanD, workerId);

    const finalFanWf = await prisma.workflow.findUnique({ where: { id: fanWfId } });
    assert(finalFanWf?.status === WorkflowStatus.COMPLETED, 'Fan-out / Fan-in Workflow overall status is COMPLETED');

    // ------------------------------------------------------------------------
    // Test 4: Cascading Parent Failure (Failure Propagation)
    // ------------------------------------------------------------------------
    console.log('\n5️⃣ Testing Cascading Parent Failure & Downstream Child Cancellation...');
    const failWfRes = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        name: 'Failure Cascade Workflow',
        nodes: [
          { key: 'parent_fail', queueId, type: 'failure_demo', maxAttempts: 1, parents: [] },
          { key: 'child_cancel', queueId, type: 'email_notification', parents: ['parent_fail'] },
        ],
      }),
    });

    const failWfData = (await failWfRes.json()) as any;
    const failWfId = failWfData.workflow.id;
    const parentFailId = failWfData.nodes.find((n: any) => n.key === 'parent_fail').job.id;
    const childCancelId = failWfData.nodes.find((n: any) => n.key === 'child_cancel').job.id;

    // Execute parent_fail job (configured to fail max attempts)
    const claimedFailParent = await claimJobs({ workerId: workerId, batchSize: 10, queueId });
    const targetFailParent = claimedFailParent.find((j) => j.id === parentFailId);
    if (targetFailParent) await executeJob(targetFailParent, workerId);

    const dbParentFail = await prisma.job.findUnique({ where: { id: parentFailId } });
    const dbChildCancel = await prisma.job.findUnique({ where: { id: childCancelId } });
    const finalFailWf = await prisma.workflow.findUnique({ where: { id: failWfId } });

    assert(dbParentFail?.status === JobStatus.DEAD, 'Parent job reached DEAD status after max attempts');
    assert(dbChildCancel?.status === JobStatus.CANCELLED, 'Child job automatically CANCELLED due to upstream parent failure');
    assert(finalFailWf?.status === WorkflowStatus.FAILED, 'Workflow overall status marked FAILED');

    console.log(`\n==================================================`);
    console.log(`🎉 Workflow Test Suite Completed: ${passedTests}/${totalTests} Passed`);
    console.log(`==================================================\n`);

    server.close();
    if (passedTests === totalTests) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('💥 Test suite crashed:', err);
    server.close();
    process.exit(1);
  }
}

runWorkflowTests();
