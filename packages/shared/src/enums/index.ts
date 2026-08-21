/**
 * ============================================================================
 * Shared Enums & Constants — Distributed Job Scheduler
 * ============================================================================
 * These enums represent the authoritative states and categories across the system.
 * Documented in detail to explain the state machine transitions for assignment viva.
 */

/**
 * Lifecycle states of a Job in the system.
 *
 * Transition Path:
 *   QUEUED ──────────► CLAIMED ──► RUNNING ──► COMPLETED
 *     ▲                                   │
 *     │                                   ▼
 *   RETRYING ◄──────── FAILED ◄───────────┘
 *                        │
 *                        ▼ (attempts >= maxAttempts)
 *                       DEAD ──► DLQ entry created
 *
 *   SCHEDULED ──► (availableAt <= NOW()) ──► QUEUED
 *   CANCELLED ──► terminal, set by user/API
 */
export enum JobStatus {
  /** Job created and awaiting a worker to claim it */
  QUEUED = 'QUEUED',
  /** Job set to run at a future timestamp (delayed or recurring) */
  SCHEDULED = 'SCHEDULED',
  /** Atomically claimed by a worker using PostgreSQL SKIP LOCKED */
  CLAIMED = 'CLAIMED',
  /** Currently executing inside a worker process handler */
  RUNNING = 'RUNNING',
  /** Successfully executed with output result */
  COMPLETED = 'COMPLETED',
  /** Failed execution attempt; backoff delay evaluated */
  FAILED = 'FAILED',
  /** Waiting out backoff delay before returning to QUEUED state */
  RETRYING = 'RETRYING',
  /** Permanent failure after reaching maxAttempts; Job row kept, DLQ entry created */
  DEAD = 'DEAD',
  /** Job cancelled manually by user or API command */
  CANCELLED = 'CANCELLED',
}

/**
 * Outcome of a single execution attempt (stored in JobExecution).
 *
 * Separated from JobStatus because an execution never goes through
 * QUEUED, RETRYING, DEAD, or CANCELLED — those are job-level lifecycle
 * states, not attempt-level outcomes.
 */
export enum ExecutionStatus {
  /** Attempt is currently executing inside the worker handler */
  RUNNING = 'RUNNING',
  /** Attempt finished successfully */
  COMPLETED = 'COMPLETED',
  /** Attempt ended with an error thrown by the handler */
  FAILED = 'FAILED',
  /** Attempt exceeded its configured timeout threshold */
  TIMED_OUT = 'TIMED_OUT',
}

/**
 * Operational states of a Queue.
 */
export enum QueueStatus {
  /** Normal operation; workers poll and claim jobs */
  ACTIVE = 'ACTIVE',
  /** Paused by administrator; workers skip claiming jobs from this queue */
  PAUSED = 'PAUSED',
}

/**
 * Algorithms used to calculate retry delay after a job failure.
 */
export enum RetryPolicyType {
  /** Constant delay between attempts (e.g. 5 seconds every time) */
  FIXED = 'FIXED',
  /** Delay increases linearly with attempts (e.g. 5s, 10s, 15s) */
  LINEAR = 'LINEAR',
  /** Delay increases exponentially (e.g. 2s, 4s, 8s, 16s) with optional jitter */
  EXPONENTIAL = 'EXPONENTIAL',
}

/**
 * Operational status of Worker Nodes in the cluster.
 */
export enum WorkerStatus {
  /** Worker process active and emitting heartbeats */
  ONLINE = 'ONLINE',
  /** Worker stopped gracefully or missed heartbeat threshold (stale) */
  OFFLINE = 'OFFLINE',
  /** Worker draining active jobs during graceful shutdown */
  DRAINING = 'DRAINING',
}

/**
 * Severity level for execution logs stored per job execution attempt.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Resolution status for jobs placed into the Dead Letter Queue.
 */
export enum DLQResolutionStatus {
  /** Awaiting admin inspection or manual replay */
  PENDING = 'PENDING',
  /** Replayed back to queue for re-execution */
  RETRIED = 'RETRIED',
  /** Archived or discarded by administrator */
  ARCHIVED = 'ARCHIVED',
}
