# Major Design Decisions & Engineering Trade-Offs

This document details the core architectural rationale and trade-offs made during the design and implementation of the Distributed Job Scheduler platform.

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

---

## 7. Distributed Rate Limiting: Redis Sliding Window Log + In-Memory Fallback

### Decision: Redis Sorted Sets (`ZSET`) with Automatic Thread-Safe Memory Fallback
- **Why**:
  1. **Precision Sliding Window**: Fixed window counters suffer from boundary bursts (2x limit at window edge). Sliding window logs using Redis `ZSET` (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) provide exact millisecond sliding window enforcement.
  2. **Zero-Downtime Resilience**: If Redis goes offline or suffers a network hiccup, the rate limiter automatically degrades gracefully to an in-memory Map with sliding timestamp arrays. The API service continues serving requests safely without crashing.
  3. **Queue Execution Throttling**: Workers check queue-level rate limits (`q.rateLimitMaxJobs`) before claiming jobs. If a queue exceeds its limit, jobs stay safely in `QUEUED` state and worker claiming for that queue is deferred until the window resets — guaranteeing zero job loss.

---

## 8. Queue Sharding: Consistent Hash Partitioning & Isolated Worker Fleets

### Decision: FNV-1a Deterministic Shard Routing with Partition-Filtered Worker Fleets
- **Why**:
  1. **Zero Index Contention**: In high-throughput systems processing millions of jobs, querying a single monolithic queue produces B-Tree index locking contention during `FOR UPDATE SKIP LOCKED` queries. Sharding partitions jobs across multiple queues (`queueId`), utilizing dedicated composite B-Tree indexes (`@@index([queueId, status, priority, availableAt])`).
  2. **Noisy Neighbor Elimination**: High-volume background tenants cannot starve critical transactional workloads. Dedicated worker fleets bound to specific queue shards (`WORKER_QUEUE_ID=<uuid>`) execute in complete isolation without lock competition.
  3. **Deterministic Consistent Hashing**: Using 32-bit FNV-1a hashing ($\text{shardIndex} = \text{fnv1a}(shardKey) \pmod N$), jobs for the same tenant/customer consistently land on the same shard for FIFO order guarantees, while load is evenly balanced across the cluster.

