# Distributed Job Scheduler — Implementation Plan

A robust, enterprise-grade, distributed job scheduling and execution platform built with TypeScript, PostgreSQL, Redis, Node.js workers, and a modern web dashboard.

---

## System Architecture Overview

```
                        ┌───────────────────────────────┐
                        │      Next.js Dashboard UI     │
                        │    (Live Metrics & Controls)  │
                        └──────────────┬────────────────┘
                                       │ HTTP / REST / SSE
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API Service (Fastify/Express)                 │
│  - Auth & RBAC (JWT)           - Queue & Project CRUD                   │
│  - Job Ingestion & Idempotency - DLQ & Retry Triggers                   │
│  - OpenAPI / Swagger Docs      - Live Metrics & Execution Logs           │
└──────────────┬───────────────────────────────┬──────────────────────────┘
               │                               │
               │ Reads & Writes                │ Read/Write Cache & State
               ▼                               ▼
    ┌──────────────────────┐        ┌──────────────────────┐
    │   PostgreSQL (ACID)  │        │     Redis Cache      │
    │  - Jobs & Queues     │        │  - Lock Coordination │
    │  - FOR UPDATE        │        │  - Metrics & Stats   │
    │    SKIP LOCKED       │        │  - Realtime Events   │
    │  - Executions & Logs │        └──────────┬───────────┘
    └──────────▲───────────┘                   │
               │                               │
               ├───────────────────────────────┤
               │                               │
┌──────────────┴──────────────┐ ┌──────────────┴──────────────┐
│       Worker Cluster        │ │      Scheduler Service      │
│  - Atomic Job Claiming      │ │  - Cron Evaluator & Trigger │
│  - Concurrency Limiter      │ │  - Delayed Job Promoter     │
│  - Exponential Retries      │ │  - Dead Worker & Stale Job  │
│  - Heartbeat & Auto-Drain   │ │    Reaper (Lease Recovery)  │
│  - Pluggable Job Handlers   │ └─────────────────────────────┘
└─────────────────────────────┘
```

---

## User Review Required

> [!IMPORTANT]
> **Database & Stack Selection**:
> 1. **Monorepo**: npm workspaces with TypeScript strict mode across all packages/apps.
> 2. **Backend Services**: Fastify / Express with TypeScript, Zod schema validation, Prisma ORM for PostgreSQL, and ioredis for Redis.
> 3. **Worker Concurrency & Safety**: PostgreSQL row-level locks with `SELECT ... FOR UPDATE SKIP LOCKED` inside transactions to guarantee exactly-once claim semantics under high concurrency across any number of worker processes.
> 4. **Frontend Dashboard**: Next.js (App Router) + Tailwind CSS + Lucide Icons + Recharts with real-time polling / SSE metrics, dark mode glassmorphism UI, interactive queue controls, job log stream, and DLQ management.

---

## Proposed Changes & Phased Implementation

### Phase 0: Monorepo Foundation & Tooling
- Initialize root `package.json` with npm workspaces (`apps/*`, `packages/*`).
- Configure root `tsconfig.json`, `tsconfig.base.json`, `.editorconfig`, `.prettierrc`, `.eslintrc.js`.
- Set up shared environment configs (`.env.example`, `.env`).
- Create package stubs:
  - `packages/shared`: Common types, interfaces, Zod schemas, backoff algorithms.
  - `packages/database`: Prisma schema, client instance, seeders.
  - `packages/logger`: Structured JSON logger with Pino.
  - `apps/api`: REST API service.
  - `apps/worker`: Job execution engine.
  - `apps/scheduler`: Cron & delayed job dispatcher, crash recovery reaper.
  - `apps/dashboard`: Modern management interface.

---

### Phase 1 & 2: Database Schema & Migrations (`packages/database`)
Define complete schema in `packages/database/prisma/schema.prisma` with comprehensive indexing, foreign keys, cascade rules, and check constraints:

- **Auth & Tenants**:
  - `User`: id, email, passwordHash, name, role, createdAt, updatedAt.
  - `Organization`: id, name, slug, createdAt, updatedAt.
  - `OrganizationMember`: id, orgId, userId, role (`OWNER`, `ADMIN`, `MEMBER`), createdAt.
  - `Project`: id, orgId, name, slug, description, createdAt, updatedAt.
- **Queue & Configuration**:
  - `Queue`: id, projectId, name, priority (1-100), concurrencyLimit (default 5), status (`ACTIVE`, `PAUSED`), retryPolicyId, createdAt, updatedAt.
  - `RetryPolicy`: id, name, type (`FIXED`, `LINEAR`, `EXPONENTIAL`), maxAttempts (default 3), initialDelayMs, maxDelayMs, backoffMultiplier, createdAt, updatedAt.
- **Jobs & Execution**:
  - `Job`: id, queueId, type, payload (JSON), priority, status (`QUEUED`, `SCHEDULED`, `CLAIMED`, `RUNNING`, `COMPLETED`, `FAILED`, `RETRYING`, `DEAD`), attempts, maxAttempts, scheduledAt, lockedUntil, idempotencyKey (unique with queueId), lastWorkerId, startedAt, completedAt, failedAt, errorReason, createdAt, updatedAt.
  - `JobExecution`: id, jobId, workerId, attemptNumber, status, startedAt, completedAt, durationMs, errorReason, stackTrace, result (JSON), createdAt.
  - `JobLog`: id, jobId, executionId, workerId, level (`DEBUG`, `INFO`, `WARN`, `ERROR`), message, metadata (JSON), timestamp.
- **Workers & Recovery**:
  - `Worker`: id, name, hostname, pid, status (`ONLINE`, `OFFLINE`, `DRAINING`), concurrency, activeJobsCount, lastHeartbeatAt, startedAt, stoppedAt, metadata (JSON).
  - `WorkerHeartbeat`: id, workerId, cpuUsage, memoryUsage, activeJobs, timestamp.
- **Scheduling & DLQ**:
  - `ScheduledJob`: id, projectId, queueId, name, cronExpression, jobType, payload (JSON), priority, enabled, nextRunAt, lastRunAt, createdAt, updatedAt.
  - `DeadLetterJob`: id, originalJobId, queueId, jobType, payload, attempts, errorReason, stackTrace, failedWorkerId, resolutionStatus (`PENDING`, `RETRIED`, `ARCHIVED`), resolvedAt, createdAt.
- **Database Seeder**: `packages/database/prisma/seed.ts` providing realistic demo users, orgs, projects, queues, jobs, and execution history.

---

### Phase 3, 4, 5: Shared Package & Core REST API (`packages/shared`, `apps/api`)
- **Shared Utilities** (`packages/shared`):
  - State machine validator (validating state transitions `QUEUED` -> `CLAIMED` -> `RUNNING` -> `COMPLETED`/`FAILED` -> `RETRYING` -> `DEAD`).
  - Retry backoff mathematical calculator with jitter (`fixedBackoff`, `linearBackoff`, `exponentialBackoff`).
  - Cron validator and next run calculator.
  - Zod validation schemas for all requests (auth, jobs, queues, projects, DLQ).
- **API Endpoints** (`apps/api`):
  - `/api/v1/auth`: `POST /register`, `POST /login`, `POST /logout`, `GET /me`.
  - `/api/v1/organizations`: CRUD organizations and members.
  - `/api/v1/projects`: CRUD projects scoped by user tenant.
  - `/api/v1/queues`: CRUD queues, pause/resume controls, concurrency adjustment, stats summary.
  - `/api/v1/jobs`:
    - `POST /` (Immediate, delayed, scheduled job creation with `idempotencyKey` support).
    - `POST /batch` (Atomic transactional batch job creation).
    - `GET /` (Filtered, sorted, paginated job listing).
    - `GET /:id` (Job details, executions, logs, retry history).
    - `POST /:id/retry` (Manual retry trigger).
    - `POST /:id/cancel` (Cancel pending/queued job).
  - `/api/v1/workers`: `GET /` (Active & offline workers, heartbeat timestamps, fleet stats).
  - `/api/v1/dlq`: `GET /` (Inspect dead-letter jobs), `POST /:id/retry` (Replay dead job), `DELETE /:id` (Archive).
  - `/api/v1/metrics`: Summary aggregates (total, running, queued, failed, success rate, throughput over time).
  - `/docs`: OpenAPI / Swagger interactive UI.

---

### Phase 6 - 16: Worker Engine & Atomic Claiming (`apps/worker`)
- **Worker Lifecycle**:
  - Auto-generate unique worker UUID, register in `Worker` table on startup as `ONLINE`.
  - Background Heartbeat Timer (every 5 seconds updating `lastHeartbeatAt` and resource stats).
  - Clean shutdown hooks on `SIGINT` / `SIGTERM`: stops taking new claims, drains active in-flight jobs within timeout, marks worker as `OFFLINE`, flushes connections.
- **Atomic Job Claim Engine**:
  - Uses transactional PostgreSQL raw query with `FOR UPDATE SKIP LOCKED` filtered by `status = 'QUEUED'`, `scheduledAt <= NOW()`, and respecting queue pause state and priority ordering (`priority DESC, createdAt ASC`).
  - Atomically transitions job to `CLAIMED` / `RUNNING`, sets `lockedUntil = NOW() + timeout`, assigns `lastWorkerId`.
- **Worker Concurrency Limiter**:
  - Worker-level semaphore ensuring worker does not exceed its configured concurrency limit.
  - Queue-level active job tracking to respect queue concurrency limits.
- **Execution & Handler Registry**:
  - Handlers for `email_notification`, `report_generation`, `data_sync`, `webhook_delivery`, `ai_summary`.
  - Custom error categorization (transient errors vs permanent fatal errors).
  - Detailed `JobExecution` and `JobLog` tracking with microsecond duration measurement.
- **Retry & DLQ Routing**:
  - On handler failure: evaluates `attempts < maxAttempts` against queue `RetryPolicy`.
  - If retryable: calculates delay using backoff multiplier, sets status `RETRYING` and `scheduledAt = NOW() + delayMs`.
  - If attempts exhausted: transitions status to `DEAD`, creates entry in `DeadLetterJob`.

---

### Phase 17 - 19: Scheduler Service & Crash Recovery (`apps/scheduler`)
- **Cron Dispatcher**:
  - Periodically scans `ScheduledJob` table where `enabled = true` and `nextRunAt <= NOW()`.
  - Enqueues new job execution instance, advances `nextRunAt` based on cron formula, prevents duplicate execution with transactional locking.
- **Delayed Job Promoter**:
  - Scans `Job` table where `status = 'SCHEDULED'` and `scheduledAt <= NOW()`, promotes to `QUEUED`.
- **Stale Worker & Crash Recovery Reaper**:
  - Detects workers with `lastHeartbeatAt < NOW() - 30s`, marks them `OFFLINE`.
  - Scans stuck jobs in `CLAIMED` / `RUNNING` where `lockedUntil < NOW()`, re-queues them or retries them so no job is ever lost or permanently locked when a worker crashes mid-execution.

---

### Phase 20 - 25: Dashboard Application (`apps/dashboard`)
- **Modern Premium Glassmorphism UI**:
  - **Overview Dashboard**: Stat cards (Total, Active, Queued, Failed, Success Rate, Avg Duration), live throughput chart (Recharts), queue load distribution.
  - **Queue Manager**: Interactive table with pause/resume toggles, priority badges, concurrency controls, queue create/edit modal.
  - **Job Explorer**: Advanced data table with search, status filters, queue filters, worker filters, pagination, and bulk actions.
  - **Job Detail Drawer/Page**: Full JSON payload viewer, status stepper timeline, execution attempt list, interactive colored log stream, one-click manual retry.
  - **Worker Fleet View**: Live worker nodes, heartbeat indicators (pulsing green/red), CPU/memory metrics, active task list.
  - **Dead Letter Queue (DLQ)**: Failed job viewer, stack trace inspection, single and batch DLQ retry / replay.
  - **New Job Trigger Form**: Test trigger modal to submit immediate, delayed, recurring, or batch jobs directly from UI.

---

### Phase 26 - 28: Automated Testing, Docker Compose, & Documentation
- **Automated Tests**:
  - Unit tests for retry backoff algorithms, cron parsing, and state transition guards.
  - Concurrency tests: Simulating multiple workers competing for 100 queued jobs using `SKIP LOCKED` to verify zero duplicate claims.
  - Crash recovery tests: Simulating worker abandonment and lease expiration auto-recovery.
- **Docker Compose**:
  - `docker-compose.yml` orchestrating PostgreSQL, Redis, API, Worker (scalable to N replicas), Scheduler, and Dashboard.
- **Documentation**:
  - `docs/ARCHITECTURE.md` (System components, flows, and data paths).
  - `docs/DATABASE_DESIGN.md` (ER diagram, indexes, constraints, and trade-off rationale).
  - `docs/DESIGN_DECISIONS.md` (Deep dive on `SKIP LOCKED`, distributed locking, crash recovery, idempotency, and scalability limits).
  - `README.md` (One-command setup, demo script, and API documentation).

---

## Verification Plan

### Automated Tests
- Run unit test suite: `npm test` (or `npm run test --workspaces`).
- Run concurrency & atomic claiming test script.
- Validate TypeScript compilation across all packages: `npm run build` / `npm run typecheck`.

### Manual & End-to-End Verification
1. Start database and Redis (or test environment).
2. Seed initial data (`npm run db:seed`).
3. Run API, Worker, Scheduler, and Dashboard in dev mode.
4. Ingest immediate jobs, delayed jobs, and batch jobs via API/Dashboard.
5. Verify worker processes them, updates logs, generates execution records, and records heartbeats.
6. Trigger a simulated failure to verify exponential retry backoff and DLQ routing.
7. Kill a worker during execution to verify scheduler recovers the stale job lease automatically.
8. Inspect live metrics and job explorer on the Dashboard.
