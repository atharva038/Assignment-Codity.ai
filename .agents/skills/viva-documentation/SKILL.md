---
name: viva-documentation
description: >-
  Guidelines for generating evaluation deliverables: Architecture Diagrams, ER Diagrams,
  API Documentation, Design Decisions & Trade-offs Document, and Setup Instructions.
---

# Viva & Evaluation Documentation Guidelines

This skill ensures all 5 required assignment deliverables are maintained in `docs/`:

---

## 📄 Required Deliverables List

1. **`docs/ARCHITECTURE.md`** (System Architecture — 20 Marks):
   - High-level block diagram (Mermaid & ASCII) showing Next.js Dashboard, Express API, PostgreSQL, Redis, Worker Nodes, and Scheduler Service.
   - Detailed component breakdown: API Layer, Data Layer, Worker Engine, Cron Evaluator, Crash Recovery Reaper.
   - Data flow diagrams for Job Creation, Atomic Claiming (`SKIP LOCKED`), Execution & Logging, Exponential Retry, and DLQ Routing.

2. **`docs/DATABASE_DESIGN.md`** (Database Design — 20 Marks):
   - Entity-Relationship (ER) Diagram (Mermaid schema).
   - Table-by-table schema documentation: Primary Keys, Foreign Keys, Unique Constraints, Nullability rationale, Indexes (specifically indexing strategies for `availableAt`, `status`, `priority`, `lockedUntil`).
   - Normalization decisions (3NF) and cascading delete/restrict rules (`onDelete: Restrict` on Queues/DLQ).

3. **`docs/DESIGN_DECISIONS.md`** (Design Decisions & Trade-Offs):
   - **Why PostgreSQL `SKIP LOCKED` over Redis locks**: Eliminates lock management overhead, guarantees ACID consistency, zero split-brain risk.
   - **Why `availableAt` over `scheduledAt`**: Clearer domain semantics for claiming (`WHERE availableAt <= NOW()`).
   - **Why separate `ExecutionStatus` from `JobStatus`**: Isolates attempt-level outcome (`RUNNING`/`COMPLETED`/`FAILED`/`TIMED_OUT`) from job-level lifecycle (`QUEUED`/`SCHEDULED`/`RETRYING`/`DEAD`).
   - **Why atomic cron locking**: Optimistic lock (`lockToken` + `lockExpiresAt`) prevents duplicate job creation across multi-replica scheduler nodes.
   - **Why DLQ preserves original Job row**: `DeadLetterJob` references `Job.id` via 1:1 FK relation to preserve complete audit history and execution logs.
   - **Idempotency & Retry Math**: Exponential backoff formula with +/-10% jitter to prevent thundering herd.

4. **`docs/API_DOCUMENTATION.md`** (API Design — 5 Marks):
   - Complete REST API specification with request/response JSON payloads, query parameters, HTTP status codes, and JWT authorization headers.

5. **`README.md`** (Setup Instructions & Quick Start):
   - One-command quickstart (`docker compose up -d && npm install && npm run db:push && npm run db:seed`).
   - Command reference for running services, Prisma Studio, and automated test suites (`npm test`).
