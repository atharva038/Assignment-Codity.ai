/**
 * ============================================================================
 * End-to-End API Integration Test Suite — Distributed Job Scheduler
 * ============================================================================
 * Automates testing for Phase 3, 4 & 5 API Endpoints:
 * 1. Health Diagnostics (GET /health)
 * 2. User Registration (POST /api/v1/auth/register)
 * 3. User Login & JWT Verification (POST /api/v1/auth/login)
 * 4. Get Current Profile (GET /api/v1/auth/me)
 * 5. Create & List Organizations (POST & GET /api/v1/organizations)
 * 6. Create & List Projects (POST & GET /api/v1/projects)
 * 7. Create & List Retry Policies (POST & GET /api/v1/retry-policies)
 * 8. Create, Update & List Queues (POST, GET, PUT /api/v1/queues)
 * 9. Pause & Resume Queue Controls (POST /api/v1/queues/:id/pause & /resume)
 * 10. Queue Live Statistics (GET /api/v1/queues/:id/stats)
 */

import dotenv from 'dotenv';
dotenv.config();

import { createApp } from '../apps/api/src/app.js';
import http from 'http';

async function runApiTests() {
  console.log('🧪 Starting End-to-End API Test Suite...\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}`;

  let authToken = '';
  let orgId = '';
  let projectId = '';
  let retryPolicyId = '';
  let queueId = '';

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
    // 1. Health Diagnostics
    // ------------------------------------------------------------------------
    console.log('1️⃣ Testing Health Diagnostics Endpoint...');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json() as any;
    assert(healthRes.status === 200, 'GET /health returns 200 OK');
    assert(healthData.status === 'healthy', 'Health status is "healthy"');

    // ------------------------------------------------------------------------
    // 2. User Registration
    // ------------------------------------------------------------------------
    console.log('\n2️⃣ Testing Authentication - User Registration...');
    const testEmail = `testuser-${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
        name: 'Test Engineer',
        organizationName: 'Automated Test Org',
      }),
    });
    const regData = await regRes.json() as any;
    assert(regRes.status === 201, 'POST /api/v1/auth/register returns 201 Created');
    assert(!!regData.token, 'Registration response includes JWT token');
    assert(!!regData.organization?.id, 'Registration creates default Organization');
    assert(!!regData.defaultProject?.id, 'Registration creates default Project');

    // ------------------------------------------------------------------------
    // 3. User Login
    // ------------------------------------------------------------------------
    console.log('\n3️⃣ Testing Authentication - User Login...');
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json() as any;
    assert(loginRes.status === 200, 'POST /api/v1/auth/login returns 200 OK');
    assert(!!loginData.token, 'Login returns valid JWT token');
    authToken = loginData.token;

    // ------------------------------------------------------------------------
    // 4. Get Current Profile (/me)
    // ------------------------------------------------------------------------
    console.log('\n4️⃣ Testing Authentication - GET /me Profile...');
    const meRes = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const meData = await meRes.json() as any;
    assert(meRes.status === 200, 'GET /api/v1/auth/me returns 200 OK');
    assert(meData.user?.email === testEmail, 'GET /me returns correct authenticated user');

    // ------------------------------------------------------------------------
    // 5. Organization Management
    // ------------------------------------------------------------------------
    console.log('\n5️⃣ Testing Organization Management APIs...');
    const orgSlug = `test-org-${Date.now()}`;
    const createOrgRes = await fetch(`${baseUrl}/api/v1/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'New Test Organization',
        slug: orgSlug,
      }),
    });
    const createOrgData = await createOrgRes.json() as any;
    assert(createOrgRes.status === 201, 'POST /api/v1/organizations returns 201 Created');
    assert(createOrgData.organization?.slug === orgSlug, 'Organization created with correct slug');
    orgId = createOrgData.organization.id;

    const listOrgsRes = await fetch(`${baseUrl}/api/v1/organizations`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const listOrgsData = await listOrgsRes.json() as any;
    assert(listOrgsRes.status === 200, 'GET /api/v1/organizations returns 200 OK');
    assert(Array.isArray(listOrgsData.organizations), 'GET /organizations returns array');

    // ------------------------------------------------------------------------
    // 6. Project Management
    // ------------------------------------------------------------------------
    console.log('\n6️⃣ Testing Project Management APIs...');
    const projectSlug = `proj-${Date.now()}`;
    const createProjectRes = await fetch(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        organizationId: orgId,
        name: 'Payments & Settlement Service',
        slug: projectSlug,
        description: 'Handles payment webhook ingestion and retry pipelines.',
      }),
    });
    const createProjectData = await createProjectRes.json() as any;
    assert(createProjectRes.status === 201, 'POST /api/v1/projects returns 201 Created');
    projectId = createProjectData.project.id;

    const listProjectsRes = await fetch(`${baseUrl}/api/v1/projects?organizationId=${orgId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const listProjectsData = await listProjectsRes.json() as any;
    assert(listProjectsRes.status === 200, 'GET /api/v1/projects returns 200 OK');
    assert(listProjectsData.projects.length > 0, 'GET /projects returns created project');

    // ------------------------------------------------------------------------
    // 7. Retry Policies
    // ------------------------------------------------------------------------
    console.log('\n7️⃣ Testing Retry Policy APIs...');
    const createPolicyRes = await fetch(`${baseUrl}/api/v1/retry-policies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: 'Custom Exponential Policy (5 attempts)',
        type: 'EXPONENTIAL',
        maxAttempts: 5,
        initialDelayMs: 2000,
        maxDelayMs: 120000,
        backoffMultiplier: 2.5,
      }),
    });
    const createPolicyData = await createPolicyRes.json() as any;
    assert(createPolicyRes.status === 201, 'POST /api/v1/retry-policies returns 201 Created');
    retryPolicyId = createPolicyData.retryPolicy.id;

    // ------------------------------------------------------------------------
    // 8. Queue Management (Create, List, Update, Pause, Resume, Stats)
    // ------------------------------------------------------------------------
    console.log('\n8️⃣ Testing Queue Management APIs...');
    const queueName = `payment-webhooks-${Date.now().toString().slice(-4)}`;
    const createQueueRes = await fetch(`${baseUrl}/api/v1/queues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        projectId,
        name: queueName,
        priority: 25,
        concurrencyLimit: 10,
        retryPolicyId,
      }),
    });
    const createQueueData = await createQueueRes.json() as any;
    assert(createQueueRes.status === 201, 'POST /api/v1/queues returns 201 Created');
    assert(createQueueData.queue?.priority === 25, 'Queue created with priority 25');
    assert(createQueueData.queue?.concurrencyLimit === 10, 'Queue created with concurrencyLimit 10');
    queueId = createQueueData.queue.id;

    // Update Queue
    console.log('\n9️⃣ Testing Queue Configuration Update...');
    const updateQueueRes = await fetch(`${baseUrl}/api/v1/queues/${queueId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        priority: 50, // Increase priority
        concurrencyLimit: 15,
      }),
    });
    const updateQueueData = await updateQueueRes.json() as any;
    assert(updateQueueRes.status === 200, 'PUT /api/v1/queues/:id returns 200 OK');
    assert(updateQueueData.queue?.priority === 50, 'Queue priority updated to 50');

    // Pause Queue
    console.log('\n🔟 Testing Queue Pause & Resume Controls...');
    const pauseQueueRes = await fetch(`${baseUrl}/api/v1/queues/${queueId}/pause`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const pauseQueueData = await pauseQueueRes.json() as any;
    assert(pauseQueueRes.status === 200, 'POST /api/v1/queues/:id/pause returns 200 OK');
    assert(pauseQueueData.queue?.status === 'PAUSED', 'Queue status changed to PAUSED');

    // Resume Queue
    const resumeQueueRes = await fetch(`${baseUrl}/api/v1/queues/${queueId}/resume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const resumeQueueData = await resumeQueueRes.json() as any;
    assert(resumeQueueRes.status === 200, 'POST /api/v1/queues/:id/resume returns 200 OK');
    assert(resumeQueueData.queue?.status === 'ACTIVE', 'Queue status changed back to ACTIVE');

    // Queue Stats
    console.log('\n1️⃣1️⃣ Testing Queue Statistics Breakdown...');
    const statsRes = await fetch(`${baseUrl}/api/v1/queues/${queueId}/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const statsData = await statsRes.json() as any;
    assert(statsRes.status === 200, 'GET /api/v1/queues/:id/stats returns 200 OK');
    assert(typeof statsData.stats?.QUEUED === 'number', 'Queue stats includes QUEUED count');

  } catch (error) {
    console.error('Fatal error during test execution:', error);
  } finally {
    server.close();
  }

  console.log(`\n==================================================`);
  console.log(`📊 TEST RESULTS SUMMARY:`);
  console.log(`   Passed: ${passedTests}/${totalTests} tests`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL API INTEGRATION TESTS PASSED 100%!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runApiTests();
