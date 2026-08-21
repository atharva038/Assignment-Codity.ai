# Major Design Decisions & Engineering Trade-Offs

This document details the core architectural rationale and trade-offs made during the design and implementation of the Distributed Job Scheduler, specifically formatted for viva defense and evaluation.

---

## 1. Atomic Job Claiming: PostgreSQL `SKIP LOCKED` vs. Redis Locks

### Decision: Native PostgreSQL `FOR UPDATE SKIP LOCKED`
- **Why**:
  1. **ACID Transactions**: PostgreSQL guarantees atomic row lock acquisition and status updates (`QUEUED` -> `RUNNING`) in a single ACID transaction.
  2. **Zero Lock Contention**: `SKIP LOCKED` instructs concurrent worker queries to bypass locked rows immediately without waiting or blocking, yielding high throughput.
  3. **No Distributed Lock Management Overhead**: Avoids complex Redis lock renewal algorithms (Redlock), split-brain risks, or lost locks due to network partitions.

---

## 2. Domain Naming: `availableAt` vs. `scheduledAt`

### Decision: Renamed `Job.scheduledAt` to `Job.availableAt`
- **Why**: "scheduledAt" is ambiguous — it could mean when the user scheduled the job vs when it is eligible to execute. `availableAt` clearly expresses domain intent: **the earliest timestamp at which a worker process is allowed to claim the job**.
- Worker claim filter: `WHERE availableAt <= NOW()`.

---

## 3. Status Separation: `ExecutionStatus` vs. `JobStatus`

### Decision: Dedicated `ExecutionStatus` enum for `JobExecution`
- **Why**: Reusing `JobStatus` for execution attempts was an anti-pattern. An individual execution attempt can only be `RUNNING`, `COMPLETED`, `FAILED`, or `TIMED_OUT`. It never enters `QUEUED`, `RETRYING`, or `DEAD` — those are job-level lifecycle states. Separating the enums prevents state machine ambiguity.

---

## 4. Multi-Replica Cron Scheduler: Optimistic Locking

### Decision: `lockToken` + `lockExpiresAt` on `ScheduledJob`
- **Why**: When running multiple instances of the Scheduler daemon for high availability, two replicas could evaluate due cron jobs at the exact same second. We use an optimistic locking query:
  ```sql
  UPDATE "scheduled_jobs"
  SET "lockToken" = $1, "lockExpiresAt" = NOW() + INTERVAL '10 seconds'
  WHERE "id" = $2 AND ("lockToken" IS NULL OR "lockExpiresAt" < NOW());
  ```
- If `rowCount === 1`, that replica acquired the tick and enqueues the job. If `rowCount === 0`, another replica won the tick. `lockExpiresAt` acts as a dead-man timer in case the winning replica crashes mid-tick.

---

## 5. DLQ Integrity: Preserving Original `Job` Rows

### Decision: 1:1 Foreign Key (`originalJobId -> Job.id`) with `onDelete: Restrict`
- **Why**: Moving a job to the Dead Letter Queue does NOT copy or delete the original `Job` row. The original `Job` row is updated to `status = DEAD`, and `DeadLetterJob` references it. This preserves the complete historical audit trail, execution attempts, and microsecond `JobLog` entries for inspection and replay.

---

## 6. Exponential Retry Backoff Math with Jitter

### Decision: $T_{delay} = \min(T_{initial} \times M^{attempts-1}, T_{max}) \pm \text{Jitter}$
- **Why**: Adding randomized jitter (+/-10%) prevents the "Thundering Herd" problem, ensuring that multiple failing jobs do not retry at the exact same microsecond and overload downstream services.
