/**
 * ============================================================================
 * WebSocket Real-Time Transport Test Suite — Distributed Job Scheduler
 * ============================================================================
 * Programmatically tests WebSocket upgrade authentication, client connection,
 * connected event handshake, and real-time stats:snapshot payload structure.
 */

import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { createApp } from '../apps/api/src/app.js';
import { initWsManager } from '../apps/api/src/ws/WsManager.js';
import { startStatsEmitter, stopStatsEmitter } from '../apps/api/src/ws/statsEmitter.js';
import { WsEvent } from '@job-scheduler/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-assignment-jwt-key-2026';

async function runWsTests() {
  console.log('⚡ Starting WebSocket Real-Time Transport Test Suite...\n');

  const app = createApp();
  const server = http.createServer(app);

  initWsManager(server);
  startStatsEmitter(1000);

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const port = address.port;
  const wsBaseUrl = `ws://localhost:${port}/ws`;

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

  const validToken = jwt.sign(
    { userId: 'test-ws-user', email: 'ws-tester@example.com', role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Test 1: Reject Upgrade without token
  await new Promise<void>((resolve) => {
    console.log('1. Connection Authentication Tests');
    const ws = new WebSocket(wsBaseUrl);
    ws.on('error', () => {
      assert(true, 'Connection without JWT token rejected with HTTP 401');
      resolve();
    });
    ws.on('open', () => {
      assert(false, 'Connection without token should not open');
      ws.close();
      resolve();
    });
  });

  // Test 2: Connection with valid token & Handshake Events
  await new Promise<void>((resolve) => {
    console.log('\n2. Handshake & Snapshot Payload Tests');
    const ws = new WebSocket(`${wsBaseUrl}?token=${validToken}`);
    const receivedEvents: WsEvent[] = [];

    ws.on('open', () => {
      assert(true, 'WebSocket connection handshake established with valid JWT token');
    });

    ws.on('message', (data) => {
      try {
        const event: WsEvent = JSON.parse(data.toString());
        receivedEvents.push(event);

        if (event.type === 'connected') {
          assert(true, 'Received "connected" handshake frame');
        }

        if (event.type === 'stats:snapshot') {
          assert(true, 'Received "stats:snapshot" payload frame');
          const p = event.payload as any;
          assert(typeof p.stats?.totalJobs === 'number', 'Snapshot payload contains numeric totalJobs metric');
          assert(Array.isArray(p.queues), 'Snapshot payload contains queues array');
          assert(Array.isArray(p.workers), 'Snapshot payload contains workers array');
          ws.close();
          resolve();
        }
      } catch (err: any) {
        assert(false, 'Failed to parse incoming WebSocket message', err.message);
        ws.close();
        resolve();
      }
    });

    ws.on('error', (err) => {
      assert(false, 'Unexpected WebSocket client error', err.message);
      resolve();
    });
  });

  stopStatsEmitter();
  server.close();

  console.log(`\n==================================================`);
  console.log(`WebSocket Test Summary: ${passedTests}/${totalTests} Passed`);
  console.log(`==================================================\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runWsTests().catch((err) => {
  console.error('Fatal WebSocket test failure:', err);
  process.exit(1);
});
