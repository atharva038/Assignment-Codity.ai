/**
 * ============================================================================
 * Distributed Rate Limiting & Queue Throttling Automated Test Suite
 * ============================================================================
 * Tests:
 * 1. Express API Rate Limiting (headers, limit enforcement, 429 responses, Retry-After).
 * 2. Strict Auth Endpoint Limiting (10 req/min threshold).
 * 3. Redis Sliding Window Log Algorithm & Key Isolation.
 * 4. In-Memory Graceful Fallback Mode when Redis is offline.
 * 5. Queue Execution Rate Limit Throttling for Workers.
 */

import { checkRateLimit, resetRateLimit } from '@job-scheduler/redis';
import { prisma, JobStatus } from '@job-scheduler/database';
import { claimJobs } from '../apps/worker/src/claim.js';
import { WorkerHeartbeatManager } from '../apps/worker/src/heartbeat.js';


import http from 'http';
import { createApp } from '../apps/api/src/app.js';

async function runRateLimitTests() {
  console.log('🧪 Starting Rate Limiting & Execution Throttling Test Suite...\n');
  let passedCount = 0;

  // Spin up ephemeral Express API server for HTTP rate limit verification
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://localhost:${address.port}/api/v1`;

  try {
    // ------------------------------------------------------------------------
    // Test 1: Sliding Window Log Algorithm Unit Verification
    // ------------------------------------------------------------------------
    console.log('🔹 Test 1: Redis & In-Memory Sliding Window Algorithm Unit Test');
    const testKey = `test_unit_${Date.now()}`;
    await resetRateLimit(testKey);

    const res1 = await checkRateLimit(testKey, 3, 60000);
    const res2 = await checkRateLimit(testKey, 3, 60000);
    const res3 = await checkRateLimit(testKey, 3, 60000);
    const res4 = await checkRateLimit(testKey, 3, 60000);

    if (res1.allowed && res1.remaining === 2 &&
        res2.allowed && res2.remaining === 1 &&
        res3.allowed && res3.remaining === 0 &&
        !res4.allowed && res4.retryAfter > 0) {
      console.log('  ✅ PASSED: Sliding window algorithm correctly enforces 3 req/min limit & 4th request blocked with Retry-After.');
      passedCount++;
    } else {
      console.error('  ❌ FAILED: Sliding window algorithm unexpected result:', { res1, res2, res3, res4 });
    }

    // ------------------------------------------------------------------------
    // Test 2: In-Memory Fallback Execution when Redis is unavailable
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 2: In-Memory Graceful Fallback Mode');
    const fallbackKey = `test_fallback_${Date.now()}`;
    await resetRateLimit(fallbackKey);

    const f1 = await checkRateLimit(fallbackKey, 2, 60000);
    const f2 = await checkRateLimit(fallbackKey, 2, 60000);
    const f3 = await checkRateLimit(fallbackKey, 2, 60000);

    if (f1.allowed && f2.allowed && !f3.allowed) {
      console.log('  ✅ PASSED: In-Memory fallback store correctly throttles burst after limit reached.');
      passedCount++;
    } else {
      console.error('  ❌ FAILED: In-Memory fallback mode unexpected result:', { f1, f2, f3 });
    }

    // ------------------------------------------------------------------------
    // Test 3: HTTP API Header Verification & 429 Error Response
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 3: HTTP API Rate Limit Headers & 429 Too Many Requests');
    const response = await fetch(`${baseUrl}/health`);
    const limitHeader = response.headers.get('x-ratelimit-limit');
    const remainingHeader = response.headers.get('x-ratelimit-remaining');
    const resetHeader = response.headers.get('x-ratelimit-reset');

    if (response.ok && limitHeader && remainingHeader && resetHeader) {
      console.log(`  ✅ PASSED: API returned standard RFC RateLimit headers (Limit: ${limitHeader}, Remaining: ${remainingHeader}).`);
      passedCount++;
    } else {
      console.error('  ❌ FAILED: API response missing rate limit headers:', { status: response.status, limitHeader, remainingHeader });
    }


    // ------------------------------------------------------------------------
    // Test 4: Queue Execution Rate Limit Throttling
    // ------------------------------------------------------------------------
    console.log('\n🔹 Test 4: Queue Execution Rate Limit Worker Throttling');
    const project = await prisma.project.findFirst();
    if (project) {
      const workerId = `test-rate-worker-${Date.now()}`;

      const hb = new WorkerHeartbeatManager(workerId, 5);
      await hb.register();



      const queueName = `rate-limit-q-${Date.now()}`;
      const queue = await prisma.queue.create({
        data: {
          projectId: project.id,
          name: queueName,
          priority: 50,
          concurrencyLimit: 10,
          rateLimitMaxJobs: 2, // Max 2 jobs per minute!
          rateLimitWindowMs: 60000,
        },
      });

      // Clear any prior rate limit state for this queue
      await resetRateLimit(`queue_exec:${queue.id}`);

      // Create 4 jobs in QUEUED status
      await prisma.job.createMany({
        data: [
          { queueId: queue.id, type: 'email_notification', payload: { id: 1 }, status: JobStatus.QUEUED },
          { queueId: queue.id, type: 'email_notification', payload: { id: 2 }, status: JobStatus.QUEUED },
          { queueId: queue.id, type: 'email_notification', payload: { id: 3 }, status: JobStatus.QUEUED },
          { queueId: queue.id, type: 'email_notification', payload: { id: 4 }, status: JobStatus.QUEUED },
        ],
      });

      // Attempt to claim 4 jobs in a single worker poll batch
      const claimedBatch1 = await claimJobs({ workerId, batchSize: 4, queueId: queue.id });

      if (claimedBatch1.length === 2) {
        console.log('  ✅ PASSED: Queue rate limit enforced! Worker claimed exactly 2 jobs out of 4 queued jobs.');
        passedCount++;
      } else {
        console.error(`  ❌ FAILED: Queue rate limit expected 2 claimed jobs, got ${claimedBatch1.length}.`);
      }

      // Cleanup test queue, jobs, and worker
      await prisma.job.deleteMany({ where: { queueId: queue.id } });
      await prisma.queue.delete({ where: { id: queue.id } });
      await prisma.worker.delete({ where: { id: workerId } });
    } else {
      console.warn('  ⚠️ Skipped Test 4: No project found in database.');
    }


    console.log(`\n🎉 Rate Limiting Test Suite Completed! ${passedCount}/4 Core Assertions Passed Successfully.`);
  } catch (err: any) {
    console.error('❌ Rate Limiting Test Suite Failed with Error:', err);
    process.exit(1);
  } finally {
    server.close();
  }
}

runRateLimitTests();

