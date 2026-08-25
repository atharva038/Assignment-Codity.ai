import React, { useState } from 'react';
import {
  Database,
  Key,
  Layers,
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  Code2,
  Table as TableIcon,
  Shield,
  Clock,
  Zap,
  Info,
  Maximize2,
} from 'lucide-react';

export type TableEntityKey =
  | 'jobs'
  | 'queues'
  | 'job_executions'
  | 'job_dependencies'
  | 'job_logs'
  | 'workers'
  | 'worker_heartbeats'
  | 'scheduled_jobs'
  | 'dead_letter_jobs'
  | 'retry_policies'
  | 'projects'
  | 'organizations'
  | 'users'
  | 'event_subscriptions';

interface ColumnDef {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  fkTarget?: string;
  isUnique?: boolean;
  isIndexed?: boolean;
  description: string;
}

interface TableEntity {
  key: TableEntityKey;
  name: string;
  schemaTable: string;
  domain: 'core' | 'governance' | 'worker' | 'tenant' | 'events';
  description: string;
  badge: string;
  color: string;
  columns: ColumnDef[];
  indexes: string[];
  invariants: string[];
}

export const DatabaseErDiagram: React.FC = () => {
  const [selectedTable, setSelectedTable] = useState<TableEntityKey>('jobs');
  const [hoveredTable, setHoveredTable] = useState<TableEntityKey | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | 'core' | 'governance' | 'worker' | 'tenant'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const tables: Record<TableEntityKey, TableEntity> = {
    jobs: {
      key: 'jobs',
      name: 'Job',
      schemaTable: 'jobs',
      domain: 'core',
      description: 'Primary state engine row representing an atomic work item. Queried using FOR UPDATE SKIP LOCKED for high-throughput claiming.',
      badge: 'Core State Machine',
      color: 'from-emerald-500 to-teal-600',
      columns: [
        { name: 'id', type: 'UUID (String)', isPk: true, description: 'Primary Key' },
        { name: 'queueId', type: 'UUID (String)', isFk: true, fkTarget: 'queues.id', description: 'Target execution queue' },
        { name: 'workflowId', type: 'UUID?', isFk: true, fkTarget: 'workflows.id', description: 'Parent DAG workflow if attached' },
        { name: 'type', type: 'String', description: 'Handler identifier (e.g. email, report)' },
        { name: 'payload', type: 'JSONB', description: 'Input arguments passed to handler' },
        { name: 'priority', type: 'Int', description: 'Execution priority (Higher claimed first)' },
        { name: 'status', type: 'JobStatus (Enum)', description: 'QUEUED, CLAIMED, RUNNING, COMPLETED, FAILED, RETRYING, DEAD' },
        { name: 'attempts', type: 'Int', description: 'Current attempt counter' },
        { name: 'maxAttempts', type: 'Int', description: 'Upper retry ceiling' },
        { name: 'unresolvedParentCount', type: 'Int', description: 'Remaining unfinished upstream DAG dependencies' },
        { name: 'availableAt', type: 'DateTime', isIndexed: true, description: 'Claim eligibility timeline threshold (NOW() >= availableAt)' },
        { name: 'lockedUntil', type: 'DateTime?', isIndexed: true, description: 'Lease timeout timestamp for crash reaper recovery' },
        { name: 'idempotencyKey', type: 'String?', isUnique: true, description: 'Deduplication key per queue' },
        { name: 'lastWorkerId', type: 'UUID?', isFk: true, fkTarget: 'workers.id', description: 'Worker PID that claimed or executed this job' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON jobs(queueId, idempotencyKey);',
        'CREATE INDEX ON jobs(queueId, status, priority DESC, availableAt ASC);',
        'CREATE INDEX ON jobs(status, availableAt);',
        'CREATE INDEX ON jobs(lockedUntil, status);',
      ],
      invariants: [
        'Atomic claiming uses `WHERE status = QUEUED AND availableAt <= NOW() ORDER BY priority DESC, availableAt ASC FOR UPDATE SKIP LOCKED`',
        'Queue deletion uses `onDelete: Restrict` to prevent accidental loss of execution history',
        'DLQ points 1:1 back to original Job row preserving complete attempt audit records',
      ],
    },
    queues: {
      key: 'queues',
      name: 'Queue',
      schemaTable: 'queues',
      domain: 'governance',
      description: 'Named partition channel governing concurrency ceilings, sliding window rate limits, and priority scheduling.',
      badge: 'Partition & Limit Engine',
      color: 'from-blue-500 to-indigo-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'projectId', type: 'UUID', isFk: true, fkTarget: 'projects.id', description: 'Parent Project container' },
        { name: 'name', type: 'String', isUnique: true, description: 'Unique queue identifier per project' },
        { name: 'priority', type: 'Int', description: 'Default processing weight' },
        { name: 'concurrencyLimit', type: 'Int', description: 'Max parallel running jobs' },
        { name: 'status', type: 'QueueStatus', description: 'ACTIVE or PAUSED' },
        { name: 'rateLimitWindowMs', type: 'Int', description: 'Execution window in milliseconds' },
        { name: 'rateLimitMaxJobs', type: 'Int?', description: 'Max job executions per window' },
        { name: 'retryPolicyId', type: 'UUID?', isFk: true, fkTarget: 'retry_policies.id', description: 'Associated retry policy' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON queues(projectId, name);',
        'CREATE INDEX ON queues(status, priority DESC);',
      ],
      invariants: [
        'PAUSED state stops worker pollers immediately without terminating active executing jobs',
        'Rate limit rules enforced atomically before job status transitions to RUNNING',
      ],
    },
    job_executions: {
      key: 'job_executions',
      name: 'JobExecution',
      schemaTable: 'job_executions',
      domain: 'core',
      description: 'Immutable ledger record for every single execution attempt of a job, capturing run duration, worker PID, errors, and output.',
      badge: 'Execution Ledger',
      color: 'from-amber-500 to-orange-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'jobId', type: 'UUID', isFk: true, fkTarget: 'jobs.id', description: 'Parent Job' },
        { name: 'workerId', type: 'UUID?', isFk: true, fkTarget: 'workers.id', description: 'Worker instance' },
        { name: 'attemptNumber', type: 'Int', description: '1-indexed attempt number' },
        { name: 'status', type: 'ExecutionStatus', description: 'RUNNING, COMPLETED, FAILED, TIMED_OUT' },
        { name: 'durationMs', type: 'Int?', description: 'Execution time in milliseconds' },
        { name: 'errorReason', type: 'String?', description: 'Error message if failed' },
        { name: 'stackTrace', type: 'Text?', description: 'Captured stack trace' },
        { name: 'result', type: 'JSONB?', description: 'Return value output' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON job_executions(jobId, attemptNumber);',
      ],
      invariants: [
        'A job can have only one execution record per attempt number',
        'Uses isolated ExecutionStatus enum distinct from JobStatus',
      ],
    },
    job_dependencies: {
      key: 'job_dependencies',
      name: 'JobDependency',
      schemaTable: 'job_dependencies',
      domain: 'core',
      description: 'Self-referencing relational edge table connecting parent jobs to child jobs in a Directed Acyclic Graph (DAG) workflow.',
      badge: 'DAG Relational Edge',
      color: 'from-purple-500 to-indigo-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'parentJobId', type: 'UUID', isFk: true, fkTarget: 'jobs.id', description: 'Upstream blocking job' },
        { name: 'childJobId', type: 'UUID', isFk: true, fkTarget: 'jobs.id', description: 'Downstream blocked job' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON job_dependencies(parentJobId, childJobId);',
        'CREATE INDEX ON job_dependencies(parentJobId);',
        'CREATE INDEX ON job_dependencies(childJobId);',
      ],
      invariants: [
        'Child jobs remain BLOCKED until parent completion decrements unresolvedParentCount to 0',
        'Circular dependencies strictly prevented at DAG submission time using Kahn\'s Algorithm',
      ],
    },
    job_logs: {
      key: 'job_logs',
      name: 'JobLog',
      schemaTable: 'job_logs',
      domain: 'core',
      description: 'Structured microsecond log stream captured during job runtime, indexed for real-time live terminal streaming.',
      badge: 'Log Stream',
      color: 'from-stone-500 to-zinc-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'jobId', type: 'UUID', isFk: true, fkTarget: 'jobs.id', description: 'Parent Job' },
        { name: 'executionId', type: 'UUID?', isFk: true, fkTarget: 'job_executions.id', description: 'Associated attempt' },
        { name: 'level', type: 'LogLevel', description: 'DEBUG, INFO, WARN, ERROR' },
        { name: 'message', type: 'String', description: 'Log message string' },
        { name: 'timestamp', type: 'DateTime', isIndexed: true, description: 'Creation timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON job_logs(jobId, timestamp);',
      ],
      invariants: [
        'Cascade deleted when parent Job is archived or deleted',
      ],
    },
    workers: {
      key: 'workers',
      name: 'Worker',
      schemaTable: 'workers',
      domain: 'worker',
      description: 'Active compute node instance in the distributed worker cluster emitting heartbeats and claiming concurrency slots.',
      badge: 'Compute Cluster Node',
      color: 'from-amber-500 to-yellow-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'workerName', type: 'String', description: 'Hostname or cluster worker alias' },
        { name: 'pid', type: 'Int', description: 'Process identifier on host' },
        { name: 'status', type: 'WorkerStatus', description: 'ONLINE, OFFLINE, DRAINING' },
        { name: 'concurrency', type: 'Int', description: 'Max parallel concurrent jobs per worker' },
        { name: 'activeJobsCount', type: 'Int', description: 'Current running job count' },
        { name: 'lastHeartbeatAt', type: 'DateTime', isIndexed: true, description: 'Last active ping timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON workers(status, lastHeartbeatAt);',
      ],
      invariants: [
        'Heartbeats emitted every 5 seconds; marked stale if >30 seconds silent',
        'Reaper daemon scans stale workers to release locked leases',
      ],
    },
    worker_heartbeats: {
      key: 'worker_heartbeats',
      name: 'WorkerHeartbeat',
      schemaTable: 'worker_heartbeats',
      domain: 'worker',
      description: 'Historical telemetry time-series logging CPU usage, RAM allocation, and active execution slots per worker.',
      badge: 'Telemetry Series',
      color: 'from-yellow-500 to-orange-500',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'workerId', type: 'UUID', isFk: true, fkTarget: 'workers.id', description: 'Worker node' },
        { name: 'cpuUsage', type: 'Float?', description: '0-100% CPU utilization' },
        { name: 'memoryUsage', type: 'Float?', description: 'MB RAM allocated' },
        { name: 'activeJobs', type: 'Int', description: 'Executing jobs count' },
        { name: 'timestamp', type: 'DateTime', isIndexed: true, description: 'Telemetry timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON worker_heartbeats(workerId, timestamp);',
      ],
      invariants: [
        'Auto-pruned after 7 days to maintain lightweight database footprint',
      ],
    },
    scheduled_jobs: {
      key: 'scheduled_jobs',
      name: 'ScheduledJob',
      schemaTable: 'scheduled_jobs',
      domain: 'governance',
      description: 'Recurring cron definitions evaluated by scheduler daemons using distributed optimistic lock tokens.',
      badge: 'Distributed Cron',
      color: 'from-pink-500 to-rose-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'queueId', type: 'UUID', isFk: true, fkTarget: 'queues.id', description: 'Target dispatch queue' },
        { name: 'name', type: 'String', description: 'Human-readable task label' },
        { name: 'cronExpression', type: 'String', description: '5-field cron (e.g. */5 * * * *)' },
        { name: 'enabled', type: 'Boolean', description: 'Active status toggle' },
        { name: 'nextRunAt', type: 'DateTime', isIndexed: true, description: 'Next scheduled trigger timestamp' },
        { name: 'lockToken', type: 'String?', description: 'UUID of winning scheduler replica' },
        { name: 'lockExpiresAt', type: 'DateTime?', description: 'Optimistic lock auto-expiration' },
      ],
      indexes: [
        'CREATE INDEX ON scheduled_jobs(enabled, nextRunAt);',
      ],
      invariants: [
        'Optimistic lock token prevents split-brain duplicate execution across multi-replica clusters',
      ],
    },
    dead_letter_jobs: {
      key: 'dead_letter_jobs',
      name: 'DeadLetterJob',
      schemaTable: 'dead_letter_jobs',
      domain: 'core',
      description: 'Permanent isolation table holding jobs that exceeded max retry attempts, preserving 1:1 foreign key audit integrity.',
      badge: 'Fault Isolation & DLQ',
      color: 'from-rose-600 to-red-700',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'originalJobId', type: 'UUID', isUnique: true, isFk: true, fkTarget: 'jobs.id', description: '1:1 reference to original Job' },
        { name: 'queueId', type: 'UUID', isFk: true, fkTarget: 'queues.id', description: 'Original queue' },
        { name: 'attempts', type: 'Int', description: 'Final attempt count reached' },
        { name: 'finalErrorReason', type: 'String?', description: 'Captured exception message' },
        { name: 'stackTrace', type: 'Text?', description: 'Full stack trace' },
        { name: 'resolutionStatus', type: 'DLQResolutionStatus', description: 'PENDING, RETRIED, ARCHIVED' },
        { name: 'aiSummary', type: 'Text?', description: 'AI diagnostic root cause failure analysis' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON dead_letter_jobs(originalJobId);',
        'CREATE INDEX ON dead_letter_jobs(resolutionStatus, createdAt);',
      ],
      invariants: [
        'Original job row preserved with status=DEAD rather than cloned or deleted',
        'Replay creates a fresh Job row and sets resolutionStatus to RETRIED',
      ],
    },
    retry_policies: {
      key: 'retry_policies',
      name: 'RetryPolicy',
      schemaTable: 'retry_policies',
      domain: 'governance',
      description: 'Reusable exponential backoff, linear, or fixed retry strategy attached to one or more queues.',
      badge: 'Backoff Math Engine',
      color: 'from-orange-500 to-amber-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'name', type: 'String', description: 'Policy identifier' },
        { name: 'type', type: 'RetryPolicyType', description: 'FIXED, LINEAR, EXPONENTIAL' },
        { name: 'maxAttempts', type: 'Int', description: 'Default attempt threshold' },
        { name: 'initialDelayMs', type: 'Int', description: 'Base delay in ms' },
        { name: 'maxDelayMs', type: 'Int', description: 'Ceiling delay in ms' },
        { name: 'backoffMultiplier', type: 'Float', description: 'Exponential multiplier (e.g. 2.0)' },
      ],
      indexes: [],
      invariants: [
        'Decorrelated +/-10% jitter applied at runtime to prevent thundering herds',
      ],
    },
    projects: {
      key: 'projects',
      name: 'Project',
      schemaTable: 'projects',
      domain: 'tenant',
      description: 'Multi-tenant organizational boundary grouping queues, workflows, and event subscriptions.',
      badge: 'Tenant Project',
      color: 'from-indigo-500 to-blue-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'organizationId', type: 'UUID', isFk: true, fkTarget: 'organizations.id', description: 'Parent Organization' },
        { name: 'name', type: 'String', description: 'Project name' },
        { name: 'slug', type: 'String', isUnique: true, description: 'URL-safe identifier' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON projects(organizationId, slug);',
      ],
      invariants: [
        'Cascades delete to associated queues, workflows, and cron definitions',
      ],
    },
    organizations: {
      key: 'organizations',
      name: 'Organization',
      schemaTable: 'organizations',
      domain: 'tenant',
      description: 'Top-level enterprise tenant boundary containing projects and role-based memberships.',
      badge: 'Enterprise Tenant',
      color: 'from-violet-500 to-purple-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'name', type: 'String', description: 'Company / Team name' },
        { name: 'slug', type: 'String', isUnique: true, description: 'Global unique slug' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON organizations(slug);',
      ],
      invariants: [
        'Role-Based Access Control enforced at Organization & Project scopes',
      ],
    },
    users: {
      key: 'users',
      name: 'User',
      schemaTable: 'users',
      domain: 'tenant',
      description: 'Platform user account with Argon2/bcrypt password hash and cross-organization memberships.',
      badge: 'IAM User',
      color: 'from-blue-500 to-cyan-600',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'email', type: 'String', isUnique: true, description: 'Unique user email' },
        { name: 'passwordHash', type: 'String', description: 'Bcrypt hashed password' },
        { name: 'role', type: 'Role (ADMIN / USER)', description: 'Platform-level superuser role' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON users(email);',
      ],
      invariants: [
        'JWT tokens cryptographically signed with HS256 / RS256 algorithm',
      ],
    },
    event_subscriptions: {
      key: 'event_subscriptions',
      name: 'EventSubscription',
      schemaTable: 'event_subscriptions',
      domain: 'events',
      description: 'Webhook listener and event router evaluating incoming JSON payloads and triggering downstream jobs or DAGs.',
      badge: 'Event Trigger Router',
      color: 'from-orange-500 to-rose-500',
      columns: [
        { name: 'id', type: 'UUID', isPk: true, description: 'Primary Key' },
        { name: 'projectId', type: 'UUID', isFk: true, fkTarget: 'projects.id', description: 'Parent Project' },
        { name: 'eventType', type: 'String', description: 'Filter pattern (e.g. payment.success, *)' },
        { name: 'targetType', type: 'EventTriggerTarget', description: 'JOB or WORKFLOW' },
        { name: 'secret', type: 'String?', description: 'HMAC SHA-256 webhook secret' },
      ],
      indexes: [
        'CREATE INDEX ON event_subscriptions(projectId, eventType, enabled);',
      ],
      invariants: [
        'Timing-safe cryptographic signature validation on all incoming webhook payloads',
      ],
    },
  };

  // Node Positions on the SVG Canvas (viewBox 0 0 1140 760)
  const nodePositions: Record<TableEntityKey, { x: number; y: number; width: number; height: number }> = {
    // Multi-tenant top left
    organizations: { x: 30, y: 40, width: 170, height: 110 },
    projects: { x: 240, y: 40, width: 170, height: 110 },
    users: { x: 30, y: 190, width: 170, height: 110 },

    // Governance top middle
    queues: { x: 460, y: 40, width: 190, height: 130 },
    retry_policies: { x: 460, y: 200, width: 190, height: 100 },
    scheduled_jobs: { x: 700, y: 40, width: 190, height: 130 },

    // Core Jobs (Center-Right)
    jobs: { x: 460, y: 350, width: 200, height: 160 },
    job_dependencies: { x: 230, y: 350, width: 180, height: 110 },
    job_executions: { x: 710, y: 350, width: 190, height: 140 },
    job_logs: { x: 940, y: 350, width: 170, height: 110 },

    // Fault Isolation & Workers (Bottom)
    dead_letter_jobs: { x: 460, y: 560, width: 200, height: 130 },
    workers: { x: 710, y: 560, width: 190, height: 130 },
    worker_heartbeats: { x: 940, y: 560, width: 170, height: 110 },
    event_subscriptions: { x: 230, y: 560, width: 180, height: 110 },
  };

  // Relational FK Edges
  const edges: Array<{ from: TableEntityKey; to: TableEntityKey; label: string; type: '1:N' | '1:1' | 'DAG' }> = [
    { from: 'organizations', to: 'projects', label: '1:N Cascade', type: '1:N' },
    { from: 'projects', to: 'queues', label: '1:N Cascade', type: '1:N' },
    { from: 'queues', to: 'jobs', label: '1:N Restrict', type: '1:N' },
    { from: 'retry_policies', to: 'queues', label: '1:N SetNull', type: '1:N' },
    { from: 'projects', to: 'scheduled_jobs', label: '1:N Cascade', type: '1:N' },
    { from: 'queues', to: 'scheduled_jobs', label: '1:N Cascade', type: '1:N' },
    { from: 'jobs', to: 'job_dependencies', label: 'Parent / Child', type: 'DAG' },
    { from: 'jobs', to: 'job_executions', label: '1:N Cascade', type: '1:N' },
    { from: 'jobs', to: 'dead_letter_jobs', label: '1:1 Restrict', type: '1:1' },
    { from: 'job_executions', to: 'job_logs', label: '1:N Cascade', type: '1:N' },
    { from: 'workers', to: 'job_executions', label: '1:N SetNull', type: '1:N' },
    { from: 'workers', to: 'worker_heartbeats', label: '1:N Cascade', type: '1:N' },
    { from: 'projects', to: 'event_subscriptions', label: '1:N Cascade', type: '1:N' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <Database className="w-3.5 h-3.5" />
            Relational Schema & B-Tree Index Graph (PostgreSQL 16)
          </div>
          <h2 className="text-xl font-extrabold text-stone-900 dark:text-zinc-100">
            Interactive Database Entity-Relationship (ER) Diagram
          </h2>
          <p className="text-xs text-stone-600 dark:text-zinc-400 max-w-2xl mt-1">
            Visual map of all 14 database models, relational foreign key cascades, <code className="font-mono text-emerald-500">SKIP LOCKED</code> claim indexes, and 1:1 DLQ audit preservation links.
          </p>
        </div>

        {/* Domain Filter Pills */}
        <div className="flex flex-wrap gap-1.5 bg-stone-100 dark:bg-zinc-850 p-1.5 rounded-xl border border-stone-200 dark:border-zinc-800">
          {[
            { id: 'all', label: 'All Models (14)' },
            { id: 'core', label: 'Core Jobs & DAGs' },
            { id: 'governance', label: 'Queues & Cron' },
            { id: 'worker', label: 'Worker Fleet' },
            { id: 'tenant', label: 'Multi-Tenant' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDomainFilter(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                domainFilter === tab.id
                  ? 'bg-emerald-500 text-white shadow-md font-semibold'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG ER DIAGRAM CANVAS */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-[#08090d] shadow-2xl overflow-hidden relative">
        <div className="px-6 py-3 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            PostgreSQL 16 • 3NF Normalized Engine • Foreign Key Graph
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1"><Key className="w-3 h-3 text-amber-400" /> PK = Primary Key</span>
            <span className="flex items-center gap-1"><Layers className="w-3 h-3 text-blue-400" /> FK = Foreign Key</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-x-auto select-none">
          <svg viewBox="0 0 1140 730" className="w-full min-w-[950px] h-auto font-sans">
            <defs>
              <linearGradient id="er-grad-core" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="er-grad-gov" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="er-grad-worker" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>

              <filter id="er-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Pattern */}
            <pattern id="er-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="rgba(255,255,255,0.05)" />
            </pattern>
            <rect width="1140" height="730" fill="url(#er-grid)" />

            {/* RELATIONAL CONNECTOR EDGES (Animated SVG Paths) */}
            {/* 1. Organizations -> Projects */}
            <path d="M 200 95 L 240 95" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 2. Projects -> Queues */}
            <path d="M 410 95 L 460 95" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 3. RetryPolicies -> Queues */}
            <path d="M 555 200 L 555 170" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" />
            {/* 4. Projects -> ScheduledJobs */}
            <path d="M 410 75 L 700 75" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="5 3" />
            {/* 5. Queues -> Jobs (Core Flow) */}
            <path d="M 555 170 L 555 350" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" className="animate-dash" filter="url(#er-glow)" />
            {/* 6. Jobs -> JobDependencies (DAG) */}
            <path d="M 460 410 L 410 410" stroke="#a855f7" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 7. Jobs -> JobExecutions */}
            <path d="M 660 410 L 710 410" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" className="animate-dash" />
            {/* 8. JobExecutions -> JobLogs */}
            <path d="M 900 410 L 940 410" stroke="#71717a" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 9. Jobs -> DeadLetterJobs */}
            <path d="M 555 510 L 555 560" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="6 3" className="animate-dash" />
            {/* 10. Workers -> JobExecutions */}
            <path d="M 805 560 L 805 490" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 11. Workers -> WorkerHeartbeats */}
            <path d="M 900 625 L 940 625" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            {/* 12. Projects -> EventSubscriptions */}
            <path d="M 325 150 L 325 560" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" />

            {/* TABLE ENTITY BOXES */}
            {Object.keys(tables).map((tblKey) => {
              const table = tables[tblKey as TableEntityKey];
              const pos = nodePositions[tblKey as TableEntityKey];
              const isSelected = selectedTable === tblKey;
              const isHovered = hoveredTable === tblKey;
              const isDimmed = domainFilter !== 'all' && table.domain !== domainFilter;

              return (
                <g
                  key={tblKey}
                  onClick={() => setSelectedTable(tblKey as TableEntityKey)}
                  onMouseEnter={() => setHoveredTable(tblKey as TableEntityKey)}
                  onMouseLeave={() => setHoveredTable(null)}
                  className={`cursor-pointer transition-all duration-200 ${
                    isDimmed ? 'opacity-25' : 'opacity-100'
                  }`}
                >
                  {/* Table Outer Card */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height={pos.height}
                    rx="10"
                    fill="#12131a"
                    stroke={
                      isSelected
                        ? '#10b981'
                        : isHovered
                        ? '#38bdf8'
                        : '#262837'
                    }
                    strokeWidth={isSelected ? '2.5' : isHovered ? '2' : '1'}
                    filter={isSelected ? 'url(#er-glow)' : undefined}
                  />

                  {/* Header Bar */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height="28"
                    rx="10"
                    fill="#1a1c27"
                  />
                  <rect
                    x={pos.x}
                    y={pos.y + 18}
                    width={pos.width}
                    height="10"
                    fill="#1a1c27"
                  />

                  {/* Table Name & Domain Icon */}
                  <text
                    x={pos.x + 10}
                    y={pos.y + 18}
                    fill={isSelected ? '#6ee7b7' : '#f4f4f5'}
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    📦 {table.name}
                  </text>

                  {/* Top Columns Preview */}
                  {table.columns.slice(0, 4).map((col, idx) => (
                    <g key={col.name}>
                      <text
                        x={pos.x + 10}
                        y={pos.y + 44 + idx * 18}
                        fill={col.isPk ? '#f59e0b' : col.isFk ? '#60a5fa' : '#a1a1aa'}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight={col.isPk || col.isFk ? 'bold' : 'normal'}
                      >
                        {col.isPk ? '🔑 ' : col.isFk ? '🔗 ' : '   '}
                        {col.name}
                      </text>
                      <text
                        x={pos.x + pos.width - 8}
                        y={pos.y + 44 + idx * 18}
                        fill="#71717a"
                        fontSize="8.5"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {col.type.split(' ')[0]}
                      </text>
                    </g>
                  ))}

                  {/* "+ N more columns" footer if truncated */}
                  {table.columns.length > 4 && (
                    <text
                      x={pos.x + 10}
                      y={pos.y + pos.height - 8}
                      fill="#71717a"
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      + {table.columns.length - 4} more fields...
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* SELECTED TABLE SCHEMA & INDEX INSPECTOR */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Col 1: Table Spec & Schema Information */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                TABLE: {tables[selectedTable].schemaTable}
              </span>
              <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono">Prisma Model</span>
            </div>

            <h3 className="text-xl font-black text-stone-900 dark:text-zinc-100">
              model {tables[selectedTable].name}
            </h3>

            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              {tables[selectedTable].description}
            </p>

            <div className="pt-2 space-y-2">
              <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-200 uppercase tracking-wider">
                Relational Invariants & ACID Guarantees
              </h4>
              <ul className="space-y-2">
                {tables[selectedTable].invariants.map((inv, idx) => (
                  <li key={idx} className="text-xs text-stone-600 dark:text-zinc-400 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{inv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Col 2: Columns & Fields Definition */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono text-stone-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-emerald-500" />
                Columns & Types ({tables[selectedTable].columns.length} Fields)
              </h4>
            </div>

            <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100 dark:bg-zinc-850 text-stone-700 dark:text-zinc-300">
                  <tr>
                    <th className="p-2.5">Field Name</th>
                    <th className="p-2.5">Data Type</th>
                    <th className="p-2.5">Key / Constraint</th>
                    <th className="p-2.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-zinc-800 text-stone-600 dark:text-zinc-400">
                  {tables[selectedTable].columns.map((col) => (
                    <tr key={col.name} className="hover:bg-stone-50 dark:hover:bg-zinc-850/50 transition">
                      <td className="p-2.5 font-bold text-stone-900 dark:text-zinc-100 flex items-center gap-1.5">
                        {col.isPk && <Key className="w-3 h-3 text-amber-500" />}
                        {col.isFk && <Layers className="w-3 h-3 text-blue-500" />}
                        <span>{col.name}</span>
                      </td>
                      <td className="p-2.5 text-orange-600 dark:text-orange-400">{col.type}</td>
                      <td className="p-2.5">
                        {col.isPk && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold text-[10px]">PRIMARY KEY</span>}
                        {col.isFk && <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold text-[10px]">FK → {col.fkTarget}</span>}
                        {col.isUnique && <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-bold text-[10px]">UNIQUE</span>}
                      </td>
                      <td className="p-2.5 text-stone-500 dark:text-zinc-400">{col.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* PostgreSQL B-Tree Indexes Card */}
            {tables[selectedTable].indexes.length > 0 && (
              <div className="pt-2 space-y-2">
                <h4 className="text-xs font-bold font-mono text-stone-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-orange-500" />
                  PostgreSQL B-Tree Indexes & High-Concurrency Queries
                </h4>
                <div className="p-3 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 font-mono text-xs space-y-1">
                  {tables[selectedTable].indexes.map((idxSql, i) => (
                    <div key={i} className="text-emerald-400">
                      {idxSql}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
