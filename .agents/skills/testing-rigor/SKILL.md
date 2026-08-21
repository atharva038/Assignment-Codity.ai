---
name: testing-rigor
description: >-
  Comprehensive testing guidelines and automation workflows for the Distributed Job Scheduler.
  Ensures every component has unit, integration, concurrency race condition, and failure recovery test suites.
---

# Testing Rigor & Concurrency Verification Guidelines

Testing carries 5 marks directly and underpins the **Reliability & Concurrency (15 marks)** and **Backend Engineering (20 marks)** evaluation criteria.

---

## 🎯 Test Suite Hierarchy

Every feature in this project must be backed by automated test scripts in `scripts/`:

1. **API Integration Tests** (`scripts/test-api.ts` -> `npm run test:api`):
   - Health diagnostics (`GET /health`)
   - Authentication & JWT security (`POST /auth/register`, `POST /auth/login`, `GET /auth/me`)
   - Tenant isolation & Organization / Project CRUD
   - Queue configuration, priority, concurrency, pause & resume controls, stats
   - Idempotency key deduplication on job creation (`POST /jobs`)
   - Batch job creation (`POST /jobs/batch`)

2. **Worker & Concurrency Tests** (`scripts/test-worker.ts` -> `npm run test:worker`):
   - Worker node registration & fleet heartbeat telemetry (`Worker` & `WorkerHeartbeat` tables)
   - High-concurrency **Atomic Job Claiming (`FOR UPDATE SKIP LOCKED`)** across parallel workers
   - **Zero Duplicate Claim Guard**: 2+ workers claiming 20+ jobs simultaneously — verified zero overlap
   - Pluggable handler execution (`email_notification`, `report_generation`, `webhook_delivery`)
   - Attempt tracking (`JobExecution`) and microsecond log stream (`JobLog`)
   - Exponential retry backoff delay calculation with jitter
   - Dead Letter Queue (`DLQ`) routing after max attempts exhausted

3. **Scheduler & Crash Recovery Tests** (`scripts/test-scheduler.ts` -> `npm run test:scheduler`):
   - **Cron Expression Evaluation**: Validates 5-field cron parsing and next run calculation
   - **Optimistic Locking Cron Trigger**: Multi-replica scheduler race test using `lockToken` + `lockExpiresAt` — verifies single job creation per cron tick
   - **Delayed Job Promotion**: Verifies jobs in `SCHEDULED` state with `availableAt <= NOW()` automatically promote to `QUEUED`
   - **Stale Worker Detection**: Verifies workers with `lastHeartbeatAt > 30s` transition to `OFFLINE`
   - **Orphaned Lease Recovery Reaper**: Simulates worker process crash (`kill -9`) mid-execution and verifies stuck jobs with expired `lockedUntil` automatically re-queue with zero lost jobs

4. **Dead Letter Queue (DLQ) Replay Tests** (`scripts/test-dlq.ts` -> `npm run test:dlq`):
   - Inspect DLQ jobs, errors, stack traces
   - Replay DLQ job (creates new `Job` row and marks DLQ entry `RETRIED`)
   - Archive / discard DLQ entry (`ARCHIVED`)

---

## 🧪 Testing Standards & Best Practices

- **Zero False Positives**: Tests must perform real database operations against PostgreSQL and assert exact database states.
- **Assertion Messages**: Every assertion must print a clear colorized message (`✅ PASSED: <description>`) explaining what was validated.
- **Cleanup & Isolation**: Use unique UUIDs/slugs for test runs to allow repeatable local execution without test pollution.
- **Unified Test Command**: Maintain `npm test` running all test suites sequentially.
