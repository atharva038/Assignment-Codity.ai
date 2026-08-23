# System Architecture — Distributed Job Scheduler

## 1. High-Level Architecture Overview

The Distributed Job Scheduler is a production-grade, fault-tolerant platform built to reliably ingest, schedule, and execute background jobs across multiple worker processes.

```mermaid
graph TD
    Client[Web Dashboard / REST API Clients] -->|HTTP REST| API[Express API Server :3000]
    API -->|Read/Write| DB[(PostgreSQL 16 Database)]
    
    subgraph "Worker Fleet"
        W1[Worker Node Alpha] -->|FOR UPDATE SKIP LOCKED| DB
        W2[Worker Node Beta] -->|FOR UPDATE SKIP LOCKED| DB
        W1 -->|Heartbeat / Telemetry| DB
        W2 -->|Heartbeat / Telemetry| DB
    end

    subgraph "Scheduler Daemon"
        SCH[Scheduler Service] -->|Cron Evaluator / Optimistic Lock| DB
        SCH -->|Delayed Promoter| DB
        SCH -->|Crash Recovery Reaper| DB
    end

    subgraph "Cache & Event Layer"
        Redis[(Redis 7 Cache / PubSub :6379)]
    end

    API -->|Cache / Metrics| Redis
```

---

## 2. Component Specifications

### A. Express API Layer & WebSocket Server (`apps/api`)
- **JWT Authentication & Tenant Security**: Parses Bearer tokens and enforces multi-tenant organization boundaries.
- **Zod Request Validation**: Validates all incoming payloads before database mutation.
- **Job Ingestion Engine**: Handles single jobs, delayed jobs (`availableAt`), batch requests, and `idempotencyKey` deduplication.
- **Real-Time WebSocket Transport**: `WsManager` server attached to `/ws` providing real-time `stats:snapshot` push and Redis Pub/Sub event broadcasting with dual-mode HTTP Polling toggle (see [WEBSOCKET_IMPLEMENTATION.md](file:///Users/atharva_beast/Desktop/Coading/Assignment-Codity.ai/docs/WEBSOCKET_IMPLEMENTATION.md)).


### B. Database Layer (`packages/database` — PostgreSQL 16)
- **Atomic Job Claiming**: Uses native `SELECT ... FOR UPDATE SKIP LOCKED` for zero-contention row locking.
- **Comprehensive Indexing**: B-Tree indexes on `(queueId, status, priority, availableAt)`, `(status, availableAt)`, and `(lockedUntil, status)`.

### C. Worker Fleet Execution Engine (`apps/worker`)
- **Concurrent Polling Loop**: Polls active queues based on worker concurrency capacity.
- **Pluggable Handler Registry**: Dispatches jobs to specialized handlers (`email_notification`, `report_generation`, `webhook_delivery`, `failure_demo`).
- **Exponential Retry & DLQ Routing**: Calculates backoff delay with jitter on failure; routes exhausted jobs (`attempts >= maxAttempts`) to Dead Letter Queue (`DEAD`).
- **Heartbeat Manager**: Emits CPU, memory, and active job load telemetry every 5 seconds.

### D. Scheduler Service (`apps/scheduler`)
- **Recurring Cron Evaluator**: Evaluates 5-field cron schedules with **Multi-Replica Optimistic Locking** (`lockToken` + `lockExpiresAt`).
- **Delayed Job Promoter**: Promotes `SCHEDULED` jobs to `QUEUED` when `availableAt <= NOW()`.
- **Crash Recovery Reaper**: Reaps silent workers (>30s stale) and recovers orphaned job leases (`lockedUntil < NOW()`) from crashed worker processes (`kill -9`).

---

## 3. Core Data Flow & State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED: Immediate Job Created
    [*] --> SCHEDULED: Delayed Job Created (availableAt > NOW)
    SCHEDULED --> QUEUED: Promoter (availableAt <= NOW)

    QUEUED --> RUNNING: Worker Claims (FOR UPDATE SKIP LOCKED)
    RUNNING --> COMPLETED: Handler Success
    RUNNING --> RETRYING: Handler Error (attempts < maxAttempts)
    RETRYING --> QUEUED: Backoff Delay Elapsed

    RUNNING --> DEAD: Handler Error (attempts >= maxAttempts)
    DEAD --> DLQ: Routed to Dead Letter Queue
    DLQ --> QUEUED: Admin Manual Replay

    RUNNING --> QUEUED: Reaper Recovery (Worker Process Crashed)
    QUEUED --> CANCELLED: User Cancellation
```

---

## 4. Event-Driven Execution & Inbound Webhooks

The platform features an asynchronous **Event Ingestion & Routing Engine** that decouples event emission from job execution.

```mermaid
graph LR
    E[Inbound Event / Webhook] -->|HMAC Verification & Idempotency| Router[Event Routing Engine]
    Router -->|Pattern Match 'payment.*'| Sub[Event Subscriptions]
    Sub -->|Target = Single Job| J[Job Enqueued in Queue]
    Sub -->|Target = DAG Workflow| W[Workflow Instantiated]
    Router --> Log[(EventLog Audit Stream)]
```

* **Dynamic Payload Interpolation**: Resolves `{{event.variable}}` tokens inside target payload templates into actual event data before enqueuing.
* **Webhook Security**: Verifies HMAC SHA-256 signatures (`x-signature-sha256`, `x-hub-signature-256`) against pre-shared subscription secrets with timing-safe comparison.
* **Idempotency Deduplication**: Ingests `idempotencyKey` to prevent duplicate job or workflow dispatches when upstream services retry webhooks.
* **Dual Execution Target**: Can dynamically dispatch either individual isolated jobs or multi-stage DAG Workflows with topological dependency resolution.

