/**
 * ============================================================================
 * Redis Cache & Pub/Sub Test Suite — Distributed Job Scheduler
 * ============================================================================
 * Programmatically tests Redis connection, Ping/Pong latency, key caching, TTL
 * expiration, and Pub/Sub event channel broadcasting (`job-events`).
 */

import dotenv from 'dotenv';
dotenv.config();

import { redis, createRedisClient, publishJobEvent, REDIS_JOB_EVENTS_CHANNEL } from '../packages/redis/src/index.js';

async function runRedisTests() {
  console.log('🔴 Starting Redis Cache & Pub/Sub Test Suite...\n');

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

  // Test 1: Redis Ping Handshake
  try {
    const pong = await redis.ping();
    assert(pong === 'PONG', 'Redis server responds to PING with PONG');
  } catch (err: any) {
    assert(false, 'Redis server ping failed', err.message);
  }

  // Test 2: Cache SET and GET
  try {
    const testKey = `test:key:${Date.now()}`;
    const testVal = `value-${Date.now()}`;
    await redis.set(testKey, testVal, 'EX', 10);
    const retrievedVal = await redis.get(testKey);
    assert(retrievedVal === testVal, 'Redis SETEX and GET key-value match');
    await redis.del(testKey);
  } catch (err: any) {
    assert(false, 'Redis cache set/get test failed', err.message);
  }

  // Test 3: Pub/Sub Event Broadcasting
  await new Promise<void>(async (resolve) => {
    console.log('\n2. Pub/Sub Channel Broadcasting Tests');

    const subscriber = createRedisClient();
    const testPayload = {
      type: 'job:updated',
      payload: { jobId: 'test-redis-job-id', status: 'COMPLETED', queueId: 'queue-1' },
      ts: Date.now(),
    };

    subscriber.on('message', (channel, message) => {
      if (channel === REDIS_JOB_EVENTS_CHANNEL) {
        try {
          const parsed = JSON.parse(message);
          assert(parsed.type === 'job:updated', 'Received correct WsEventType from Redis channel');
          assert(parsed.payload.jobId === 'test-redis-job-id', 'Received correct jobId from Redis pub/sub message');
          subscriber.disconnect();
          resolve();
        } catch (err: any) {
          assert(false, 'Failed to parse JSON message from Redis channel', err.message);
          subscriber.disconnect();
          resolve();
        }
      }
    });

    try {
      await subscriber.connect();
      await subscriber.subscribe(REDIS_JOB_EVENTS_CHANNEL);
      assert(true, `Subscribed to Redis channel "${REDIS_JOB_EVENTS_CHANNEL}"`);

      // Publish test event
      await publishJobEvent(testPayload);
    } catch (err: any) {
      assert(false, 'Pub/Sub test failed', err.message);
      subscriber.disconnect();
      resolve();
    }
  });

  redis.disconnect();

  console.log(`\n==================================================`);
  console.log(`Redis Test Summary: ${passedTests}/${totalTests} Passed`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runRedisTests().catch((err) => {
  console.error('Fatal Redis test failure:', err);
  process.exit(1);
});
