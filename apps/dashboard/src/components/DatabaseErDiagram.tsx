import React, { useState, useEffect } from 'react';
import {
  Database,
  Key,
  Layers,
  Sparkles,
  Search,
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
  X,
  Copy,
  Check,
  FileCode,
  Braces,
  GitFork,
  ExternalLink,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

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
  defaultValue?: string;
  nullable?: boolean;
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
  relations: {
    parents: Array<{ table: string; field: string; onAction: string }>;
    children: Array<{ table: string; field: string; onAction: string }>;
  };
  mockData: Record<string, any>;
  prismaCode: string;
}

export const DatabaseErDiagram: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedTable, setSelectedTable] = useState<TableEntityKey>('jobs');
  const [hoveredTable, setHoveredTable] = useState<TableEntityKey | null>(null);
  const [domainFilter, setDomainFilter] = useState<'all' | 'core' | 'governance' | 'worker' | 'tenant'>('all');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalTab, setModalTab] = useState<'args' | 'relations' | 'indexes' | 'json' | 'prisma'>('args');
  const [columnSearch, setColumnSearch] = useState<string>('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

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
        { name: 'id', type: 'UUID (String)', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Unique primary identifier' },
        { name: 'queueId', type: 'UUID (String)', isFk: true, fkTarget: 'queues.id', description: 'Target queue defining execution limits' },
        { name: 'workflowId', type: 'UUID?', nullable: true, isFk: true, fkTarget: 'workflows.id', description: 'Parent DAG workflow if attached' },
        { name: 'type', type: 'String', description: 'Handler identifier (e.g. email, report, webhook)' },
        { name: 'payload', type: 'JSONB', defaultValue: '{}', description: 'Structured JSON input arguments' },
        { name: 'priority', type: 'Int', defaultValue: '10', description: 'Execution priority weight (Higher claimed first)' },
        { name: 'status', type: 'JobStatus (Enum)', defaultValue: 'QUEUED', isIndexed: true, description: 'QUEUED, CLAIMED, RUNNING, COMPLETED, FAILED, RETRYING, DEAD' },
        { name: 'attempts', type: 'Int', defaultValue: '0', description: 'Current attempt counter' },
        { name: 'maxAttempts', type: 'Int', defaultValue: '3', description: 'Upper retry ceiling' },
        { name: 'unresolvedParentCount', type: 'Int', defaultValue: '0', description: 'Remaining unfinished upstream DAG dependencies' },
        { name: 'availableAt', type: 'DateTime', isIndexed: true, defaultValue: 'NOW()', description: 'Claim eligibility timeline threshold (NOW() >= availableAt)' },
        { name: 'lockedUntil', type: 'DateTime?', nullable: true, isIndexed: true, description: 'Lease timeout timestamp for crash reaper recovery' },
        { name: 'idempotencyKey', type: 'String?', nullable: true, isUnique: true, description: 'Deduplication key per queue' },
        { name: 'lastWorkerId', type: 'UUID?', nullable: true, isFk: true, fkTarget: 'workers.id', description: 'Worker instance that claimed or executed this job' },
        { name: 'timeoutMs', type: 'Int', defaultValue: '30000', description: 'Execution timeout before lease expires' },
        { name: 'createdAt', type: 'DateTime', defaultValue: 'NOW()', description: 'Job creation timestamp' },
        { name: 'updatedAt', type: 'DateTime', description: 'Last state change timestamp' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON jobs(queueId, idempotencyKey);',
        'CREATE INDEX ON jobs(queueId, status, priority DESC, availableAt ASC);',
        'CREATE INDEX ON jobs(status, availableAt);',
        'CREATE INDEX ON jobs(lockedUntil, status);',
        'CREATE INDEX ON jobs(workflowId);',
      ],
      invariants: [
        'Atomic claiming uses `WHERE status = QUEUED AND availableAt <= NOW() ORDER BY priority DESC, availableAt ASC FOR UPDATE SKIP LOCKED`',
        'Queue deletion uses `onDelete: Restrict` to prevent accidental loss of execution history',
        'DLQ points 1:1 back to original Job row preserving complete attempt audit records',
      ],
      relations: {
        parents: [
          { table: 'Queue', field: 'queueId', onAction: 'RESTRICT (Cannot delete active queue with jobs)' },
          { table: 'Worker', field: 'lastWorkerId', onAction: 'SET NULL (Worker termination clears reference)' },
          { table: 'Workflow', field: 'workflowId', onAction: 'CASCADE (Workflow deletion cascades to jobs)' },
        ],
        children: [
          { table: 'JobExecution', field: 'jobId', onAction: 'CASCADE (Historical execution records)' },
          { table: 'JobLog', field: 'jobId', onAction: 'CASCADE (Microsecond log stream)' },
          { table: 'DeadLetterJob', field: 'originalJobId', onAction: 'RESTRICT (1:1 Dead letter isolation)' },
          { table: 'JobDependency', field: 'parentJobId / childJobId', onAction: 'CASCADE (DAG Relational Edges)' },
        ],
      },
      mockData: {
        id: "7f8b9a12-4c3d-4e5f-8a9b-0c1d2e3f4a5b",
        queueId: "queue-email-uuid-01",
        workflowId: null,
        type: "email_notification",
        payload: { to: "user@codity.ai", template: "welcome_v2", priorityLevel: "high" },
        priority: 20,
        status: "QUEUED",
        attempts: 0,
        maxAttempts: 3,
        unresolvedParentCount: 0,
        availableAt: new Date().toISOString(),
        timeoutMs: 30000,
        idempotencyKey: "evt_signup_9921",
        lockedUntil: null,
      },
      prismaCode: `model Job {
  id                    String          @id @default(uuid())
  queueId               String
  workflowId            String?
  type                  String
  payload               Json
  priority              Int             @default(10)
  status                JobStatus       @default(QUEUED)
  attempts              Int             @default(0)
  maxAttempts           Int             @default(3)
  unresolvedParentCount Int             @default(0)
  availableAt           DateTime        @default(now())
  timeoutMs             Int             @default(30000)
  idempotencyKey        String?
  lastWorkerId          String?
  lockedUntil           DateTime?

  queue                 Queue           @relation(fields: [queueId], references: [id], onDelete: Restrict)
  executions            JobExecution[]
  logs                  JobLog[]
  deadLetterJob         DeadLetterJob?

  @@unique([queueId, idempotencyKey])
  @@index([queueId, status, priority, availableAt])
  @@map("jobs")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Unique primary identifier' },
        { name: 'projectId', type: 'UUID', isFk: true, fkTarget: 'projects.id', description: 'Parent Project container' },
        { name: 'name', type: 'String', isUnique: true, description: 'Unique queue identifier per project' },
        { name: 'priority', type: 'Int', defaultValue: '10', description: 'Default processing weight' },
        { name: 'concurrencyLimit', type: 'Int', defaultValue: '5', description: 'Max parallel running jobs' },
        { name: 'status', type: 'QueueStatus', defaultValue: 'ACTIVE', isIndexed: true, description: 'ACTIVE or PAUSED' },
        { name: 'rateLimitWindowMs', type: 'Int', defaultValue: '60000', description: 'Execution window in milliseconds' },
        { name: 'rateLimitMaxJobs', type: 'Int?', nullable: true, description: 'Max job executions per window' },
        { name: 'retryPolicyId', type: 'UUID?', nullable: true, isFk: true, fkTarget: 'retry_policies.id', description: 'Associated retry policy' },
        { name: 'createdAt', type: 'DateTime', defaultValue: 'NOW()', description: 'Queue creation timestamp' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON queues(projectId, name);',
        'CREATE INDEX ON queues(status, priority DESC);',
      ],
      invariants: [
        'PAUSED state stops worker pollers immediately without terminating active executing jobs',
        'Rate limit rules enforced atomically before job status transitions to RUNNING',
      ],
      relations: {
        parents: [
          { table: 'Project', field: 'projectId', onAction: 'CASCADE' },
          { table: 'RetryPolicy', field: 'retryPolicyId', onAction: 'SET NULL' },
        ],
        children: [
          { table: 'Job', field: 'queueId', onAction: 'RESTRICT (Guards production history)' },
          { table: 'ScheduledJob', field: 'queueId', onAction: 'CASCADE' },
          { table: 'DeadLetterJob', field: 'queueId', onAction: 'RESTRICT' },
        ],
      },
      mockData: {
        id: "queue-email-01",
        projectId: "proj-core-prod",
        name: "email-notifications",
        priority: 15,
        concurrencyLimit: 8,
        status: "ACTIVE",
        rateLimitWindowMs: 60000,
        rateLimitMaxJobs: 100,
      },
      prismaCode: `model Queue {
  id               String         @id @default(uuid())
  projectId        String
  name             String
  priority         Int            @default(10)
  concurrencyLimit Int            @default(5)
  status           QueueStatus    @default(ACTIVE)
  rateLimitWindowMs Int           @default(60000)
  rateLimitMaxJobs  Int?

  project          Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  jobs             Job[]

  @@unique([projectId, name])
  @@map("queues")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary execution attempt ID' },
        { name: 'jobId', type: 'UUID', isFk: true, fkTarget: 'jobs.id', description: 'Parent Job' },
        { name: 'workerId', type: 'UUID?', nullable: true, isFk: true, fkTarget: 'workers.id', description: 'Worker instance PID' },
        { name: 'attemptNumber', type: 'Int', description: '1-indexed attempt number' },
        { name: 'status', type: 'ExecutionStatus', defaultValue: 'RUNNING', description: 'RUNNING, COMPLETED, FAILED, TIMED_OUT' },
        { name: 'startedAt', type: 'DateTime', defaultValue: 'NOW()', description: 'Execution start timestamp' },
        { name: 'completedAt', type: 'DateTime?', nullable: true, description: 'Execution completion timestamp' },
        { name: 'durationMs', type: 'Int?', nullable: true, description: 'Execution duration in milliseconds' },
        { name: 'errorReason', type: 'String?', nullable: true, description: 'Error message if failed' },
        { name: 'stackTrace', type: 'Text?', nullable: true, description: 'Captured exception stack trace' },
        { name: 'result', type: 'JSONB?', nullable: true, description: 'Return value output' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON job_executions(jobId, attemptNumber);',
      ],
      invariants: [
        'A job can have only one execution record per attempt number',
        'Uses isolated ExecutionStatus enum distinct from JobStatus',
      ],
      relations: {
        parents: [
          { table: 'Job', field: 'jobId', onAction: 'CASCADE' },
          { table: 'Worker', field: 'workerId', onAction: 'SET NULL' },
        ],
        children: [
          { table: 'JobLog', field: 'executionId', onAction: 'SET NULL' },
        ],
      },
      mockData: {
        id: "exec-attempt-001",
        jobId: "7f8b9a12-4c3d-4e5f-8a9b-0c1d2e3f4a5b",
        workerId: "worker-node-alpha",
        attemptNumber: 1,
        status: "COMPLETED",
        durationMs: 420,
        result: { delivered: true, messageId: "msg_9921_ses" },
      },
      prismaCode: `model JobExecution {
  id            String          @id @default(uuid())
  jobId         String
  workerId      String?
  attemptNumber Int
  status        ExecutionStatus @default(RUNNING)
  durationMs    Int?
  result        Json?

  job           Job             @relation(fields: [jobId], references: [id], onDelete: Cascade)
  worker        Worker?         @relation(fields: [workerId], references: [id], onDelete: SetNull)

  @@unique([jobId, attemptNumber])
  @@map("job_executions")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Edge identifier' },
        { name: 'parentJobId', type: 'UUID', isFk: true, isIndexed: true, fkTarget: 'jobs.id', description: 'Upstream blocking parent job' },
        { name: 'childJobId', type: 'UUID', isFk: true, isIndexed: true, fkTarget: 'jobs.id', description: 'Downstream blocked child job' },
        { name: 'createdAt', type: 'DateTime', defaultValue: 'NOW()', description: 'DAG link creation timestamp' },
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
      relations: {
        parents: [
          { table: 'Job (Parent)', field: 'parentJobId', onAction: 'CASCADE' },
          { table: 'Job (Child)', field: 'childJobId', onAction: 'CASCADE' },
        ],
        children: [],
      },
      mockData: {
        id: "dag-edge-01",
        parentJobId: "job-step-a-ingest",
        childJobId: "job-step-b-generate-pdf",
      },
      prismaCode: `model JobDependency {
  id          String   @id @default(uuid())
  parentJobId String
  childJobId  String

  parentJob   Job      @relation("ParentDependencies", fields: [parentJobId], references: [id], onDelete: Cascade)
  childJob    Job      @relation("ChildDependencies", fields: [childJobId], references: [id], onDelete: Cascade)

  @@unique([parentJobId, childJobId])
  @@map("job_dependencies")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary log ID' },
        { name: 'jobId', type: 'UUID', isFk: true, isIndexed: true, fkTarget: 'jobs.id', description: 'Parent Job' },
        { name: 'executionId', type: 'UUID?', nullable: true, isFk: true, fkTarget: 'job_executions.id', description: 'Associated attempt' },
        { name: 'level', type: 'LogLevel', defaultValue: 'INFO', description: 'DEBUG, INFO, WARN, ERROR' },
        { name: 'message', type: 'String', description: 'Log message string' },
        { name: 'metadata', type: 'JSONB?', nullable: true, description: 'Structured JSON log parameters' },
        { name: 'timestamp', type: 'DateTime', isIndexed: true, defaultValue: 'NOW()', description: 'Creation timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON job_logs(jobId, timestamp);',
      ],
      invariants: [
        'Cascade deleted when parent Job is archived or deleted',
      ],
      relations: {
        parents: [
          { table: 'Job', field: 'jobId', onAction: 'CASCADE' },
          { table: 'JobExecution', field: 'executionId', onAction: 'SET NULL' },
        ],
        children: [],
      },
      mockData: {
        id: "log-99128",
        jobId: "7f8b9a12-4c3d-4e5f-8a9b-0c1d2e3f4a5b",
        level: "INFO",
        message: "Connecting to remote SMTP relay (smtp.sendgrid.net:587)",
        timestamp: new Date().toISOString(),
      },
      prismaCode: `model JobLog {
  id        String    @id @default(uuid())
  jobId     String
  level     LogLevel  @default(INFO)
  message   String
  timestamp DateTime  @default(now())

  job       Job       @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, timestamp])
  @@map("job_logs")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Unique worker instance ID' },
        { name: 'workerName', type: 'String', description: 'Hostname or cluster worker alias' },
        { name: 'pid', type: 'Int', description: 'Process identifier on host' },
        { name: 'status', type: 'WorkerStatus', defaultValue: 'ONLINE', isIndexed: true, description: 'ONLINE, OFFLINE, DRAINING' },
        { name: 'concurrency', type: 'Int', defaultValue: '5', description: 'Max parallel concurrent jobs per worker' },
        { name: 'activeJobsCount', type: 'Int', defaultValue: '0', description: 'Current running job count' },
        { name: 'lastHeartbeatAt', type: 'DateTime', isIndexed: true, defaultValue: 'NOW()', description: 'Last active ping timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON workers(status, lastHeartbeatAt);',
      ],
      invariants: [
        'Heartbeats emitted every 5 seconds; marked stale if >30 seconds silent',
        'Reaper daemon scans stale workers to release locked leases',
      ],
      relations: {
        parents: [],
        children: [
          { table: 'JobExecution', field: 'workerId', onAction: 'SET NULL' },
          { table: 'WorkerHeartbeat', field: 'workerId', onAction: 'CASCADE' },
        ],
      },
      mockData: {
        id: "worker-node-alpha",
        workerName: "worker-pool-node-01.internal",
        pid: 4092,
        status: "ONLINE",
        concurrency: 5,
        activeJobsCount: 2,
        lastHeartbeatAt: new Date().toISOString(),
      },
      prismaCode: `model Worker {
  id              String            @id @default(uuid())
  workerName      String
  pid             Int
  status          WorkerStatus      @default(ONLINE)
  concurrency     Int               @default(5)
  activeJobsCount Int               @default(0)
  lastHeartbeatAt DateTime          @default(now())

  heartbeats      WorkerHeartbeat[]

  @@index([status, lastHeartbeatAt])
  @@map("workers")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary heartbeat tick ID' },
        { name: 'workerId', type: 'UUID', isFk: true, isIndexed: true, fkTarget: 'workers.id', description: 'Worker node' },
        { name: 'cpuUsage', type: 'Float?', nullable: true, description: '0-100% CPU utilization' },
        { name: 'memoryUsage', type: 'Float?', nullable: true, description: 'MB RAM allocated' },
        { name: 'activeJobs', type: 'Int', defaultValue: '0', description: 'Executing jobs count' },
        { name: 'timestamp', type: 'DateTime', isIndexed: true, defaultValue: 'NOW()', description: 'Telemetry timestamp' },
      ],
      indexes: [
        'CREATE INDEX ON worker_heartbeats(workerId, timestamp);',
      ],
      invariants: [
        'Auto-pruned after 7 days to maintain lightweight database footprint',
      ],
      relations: {
        parents: [
          { table: 'Worker', field: 'workerId', onAction: 'CASCADE' },
        ],
        children: [],
      },
      mockData: {
        id: "hb-99120",
        workerId: "worker-node-alpha",
        cpuUsage: 14.8,
        memoryUsage: 84.5,
        activeJobs: 2,
        timestamp: new Date().toISOString(),
      },
      prismaCode: `model WorkerHeartbeat {
  id          String   @id @default(uuid())
  workerId    String
  cpuUsage    Float?
  memoryUsage Float?
  activeJobs  Int      @default(0)
  timestamp   DateTime @default(now())

  worker      Worker   @relation(fields: [workerId], references: [id], onDelete: Cascade)

  @@index([workerId, timestamp])
  @@map("worker_heartbeats")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary cron ID' },
        { name: 'queueId', type: 'UUID', isFk: true, fkTarget: 'queues.id', description: 'Target dispatch queue' },
        { name: 'name', type: 'String', description: 'Human-readable task label' },
        { name: 'cronExpression', type: 'String', description: '5-field cron (e.g. */5 * * * *)' },
        { name: 'enabled', type: 'Boolean', defaultValue: 'true', isIndexed: true, description: 'Active status toggle' },
        { name: 'nextRunAt', type: 'DateTime', isIndexed: true, description: 'Next scheduled trigger timestamp' },
        { name: 'lockToken', type: 'String?', nullable: true, description: 'UUID of winning scheduler replica' },
        { name: 'lockExpiresAt', type: 'DateTime?', nullable: true, description: 'Optimistic lock auto-expiration' },
      ],
      indexes: [
        'CREATE INDEX ON scheduled_jobs(enabled, nextRunAt);',
      ],
      invariants: [
        'Optimistic lock token prevents split-brain duplicate execution across multi-replica clusters',
      ],
      relations: {
        parents: [
          { table: 'Queue', field: 'queueId', onAction: 'CASCADE' },
          { table: 'Project', field: 'projectId', onAction: 'CASCADE' },
        ],
        children: [],
      },
      mockData: {
        id: "cron-daily-cleanup",
        queueId: "queue-maintenance",
        name: "Daily Table Partition Prune",
        cronExpression: "0 0 * * *",
        enabled: true,
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        lockToken: null,
      },
      prismaCode: `model ScheduledJob {
  id             String    @id @default(uuid())
  queueId        String
  name           String
  cronExpression String
  enabled        Boolean   @default(true)
  nextRunAt      DateTime
  lockToken      String?
  lockExpiresAt  DateTime?

  queue          Queue     @relation(fields: [queueId], references: [id], onDelete: Cascade)

  @@index([enabled, nextRunAt])
  @@map("scheduled_jobs")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary DLQ record ID' },
        { name: 'originalJobId', type: 'UUID', isUnique: true, isFk: true, fkTarget: 'jobs.id', description: '1:1 reference to original Job' },
        { name: 'queueId', type: 'UUID', isFk: true, fkTarget: 'queues.id', description: 'Original queue' },
        { name: 'attempts', type: 'Int', description: 'Final attempt count reached' },
        { name: 'finalErrorReason', type: 'String?', nullable: true, description: 'Captured exception message' },
        { name: 'stackTrace', type: 'Text?', nullable: true, description: 'Full stack trace' },
        { name: 'resolutionStatus', type: 'DLQResolutionStatus', defaultValue: 'PENDING', isIndexed: true, description: 'PENDING, RETRIED, ARCHIVED' },
        { name: 'aiSummary', type: 'Text?', nullable: true, description: 'AI diagnostic root cause failure analysis' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON dead_letter_jobs(originalJobId);',
        'CREATE INDEX ON dead_letter_jobs(resolutionStatus, createdAt);',
      ],
      invariants: [
        'Original job row preserved with status=DEAD rather than cloned or deleted',
        'Replay creates a fresh Job row and sets resolutionStatus to RETRIED',
      ],
      relations: {
        parents: [
          { table: 'Job', field: 'originalJobId', onAction: 'RESTRICT (1:1 Audit Link)' },
          { table: 'Queue', field: 'queueId', onAction: 'RESTRICT' },
        ],
        children: [],
      },
      mockData: {
        id: "dlq-entry-99",
        originalJobId: "7f8b9a12-4c3d-4e5f-8a9b-0c1d2e3f4a5b",
        queueId: "queue-email-01",
        attempts: 3,
        finalErrorReason: "HTTP 503: External API rate limit exceeded",
        resolutionStatus: "PENDING",
        aiSummary: "Downstream rate limit ceiling reached. Recommend increasing retry maxDelay to 300s.",
      },
      prismaCode: `model DeadLetterJob {
  id               String              @id @default(uuid())
  originalJobId    String              @unique
  queueId          String
  attempts         Int
  finalErrorReason String?
  resolutionStatus DLQResolutionStatus @default(PENDING)

  originalJob      Job                 @relation(fields: [originalJobId], references: [id], onDelete: Restrict)
  queue            Queue               @relation(fields: [queueId], references: [id], onDelete: Restrict)

  @@index([resolutionStatus, createdAt])
  @@map("dead_letter_jobs")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary policy ID' },
        { name: 'name', type: 'String', description: 'Policy identifier (e.g. standard_exponential)' },
        { name: 'type', type: 'RetryPolicyType', defaultValue: 'EXPONENTIAL', description: 'FIXED, LINEAR, EXPONENTIAL' },
        { name: 'maxAttempts', type: 'Int', defaultValue: '3', description: 'Default attempt threshold' },
        { name: 'initialDelayMs', type: 'Int', defaultValue: '1000', description: 'Base delay in ms' },
        { name: 'maxDelayMs', type: 'Int', defaultValue: '60000', description: 'Ceiling delay in ms' },
        { name: 'backoffMultiplier', type: 'Float', defaultValue: '2.0', description: 'Exponential multiplier' },
      ],
      indexes: [],
      invariants: [
        'Decorrelated +/-10% jitter applied at runtime to prevent thundering herds',
      ],
      relations: {
        parents: [],
        children: [
          { table: 'Queue', field: 'retryPolicyId', onAction: 'SET NULL' },
        ],
      },
      mockData: {
        id: "policy-exp-default",
        name: "Standard Exponential with Jitter",
        type: "EXPONENTIAL",
        maxAttempts: 3,
        initialDelayMs: 1000,
        maxDelayMs: 60000,
        backoffMultiplier: 2.0,
      },
      prismaCode: `model RetryPolicy {
  id                String          @id @default(uuid())
  name              String
  type              RetryPolicyType @default(EXPONENTIAL)
  maxAttempts       Int             @default(3)
  initialDelayMs    Int             @default(1000)
  maxDelayMs        Int             @default(60000)
  backoffMultiplier Float           @default(2.0)
  queues            Queue[]

  @@map("retry_policies")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary project ID' },
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
      relations: {
        parents: [
          { table: 'Organization', field: 'organizationId', onAction: 'CASCADE' },
        ],
        children: [
          { table: 'Queue', field: 'projectId', onAction: 'CASCADE' },
          { table: 'ScheduledJob', field: 'projectId', onAction: 'CASCADE' },
          { table: 'EventSubscription', field: 'projectId', onAction: 'CASCADE' },
        ],
      },
      mockData: {
        id: "proj-production-01",
        organizationId: "org-codity-corp",
        name: "Production Cluster",
        slug: "prod-cluster",
      },
      prismaCode: `model Project {
  id             String         @id @default(uuid())
  organizationId String
  name           String
  slug           String
  queues         Queue[]

  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, slug])
  @@map("projects")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary organization ID' },
        { name: 'name', type: 'String', description: 'Company / Team name' },
        { name: 'slug', type: 'String', isUnique: true, description: 'Global unique slug' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON organizations(slug);',
      ],
      invariants: [
        'Role-Based Access Control enforced at Organization & Project scopes',
      ],
      relations: {
        parents: [],
        children: [
          { table: 'Project', field: 'organizationId', onAction: 'CASCADE' },
        ],
      },
      mockData: {
        id: "org-codity-corp",
        name: "Codity Enterprise",
        slug: "codity-ai",
      },
      prismaCode: `model Organization {
  id        String    @id @default(uuid())
  name      String
  slug      String    @unique
  projects  Project[]

  @@map("organizations")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary user ID' },
        { name: 'email', type: 'String', isUnique: true, description: 'Unique user email' },
        { name: 'passwordHash', type: 'String', description: 'Bcrypt hashed password' },
        { name: 'role', type: 'Role (ADMIN / USER)', defaultValue: 'USER', description: 'Platform-level superuser role' },
      ],
      indexes: [
        'CREATE UNIQUE INDEX ON users(email);',
      ],
      invariants: [
        'JWT tokens cryptographically signed with HS256 / RS256 algorithm',
      ],
      relations: {
        parents: [],
        children: [],
      },
      mockData: {
        id: "usr-admin-01",
        email: "admin@codity.ai",
        name: "System Administrator",
        role: "ADMIN",
      },
      prismaCode: `model User {
  id           String               @id @default(uuid())
  email        String               @unique
  passwordHash String
  name         String
  role         Role                 @default(USER)

  @@map("users")
}`,
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
        { name: 'id', type: 'UUID', isPk: true, defaultValue: 'uuid_generate_v4()', description: 'Primary subscription ID' },
        { name: 'projectId', type: 'UUID', isFk: true, fkTarget: 'projects.id', description: 'Parent Project' },
        { name: 'eventType', type: 'String', description: 'Filter pattern (e.g. payment.success, *)' },
        { name: 'targetType', type: 'EventTriggerTarget', defaultValue: 'JOB', description: 'JOB or WORKFLOW' },
        { name: 'secret', type: 'String?', nullable: true, description: 'HMAC SHA-256 webhook secret' },
      ],
      indexes: [
        'CREATE INDEX ON event_subscriptions(projectId, eventType, enabled);',
      ],
      invariants: [
        'Timing-safe cryptographic signature validation on all incoming webhook payloads',
      ],
      relations: {
        parents: [
          { table: 'Project', field: 'projectId', onAction: 'CASCADE' },
        ],
        children: [],
      },
      mockData: {
        id: "sub-stripe-webhook",
        projectId: "proj-production-01",
        eventType: "payment.succeeded",
        targetType: "JOB",
        enabled: true,
      },
      prismaCode: `model EventSubscription {
  id          String             @id @default(uuid())
  projectId   String
  eventType   String
  targetType  EventTriggerTarget @default(JOB)
  secret      String?

  project     Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, eventType, enabled])
  @@map("event_subscriptions")
}`,
    },
  };

  const currentTable = tables[selectedTable];

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

  // Filtered columns for search inside the modal
  const filteredColumns = currentTable.columns.filter((c) =>
    c.name.toLowerCase().includes(columnSearch.toLowerCase()) ||
    c.type.toLowerCase().includes(columnSearch.toLowerCase()) ||
    c.description.toLowerCase().includes(columnSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card & Domain Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Database className="w-3.5 h-3.5" />
            Relational Schema & B-Tree Index Graph (PostgreSQL 16)
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 dark:text-zinc-100 tracking-tight">
            Interactive Database Entity-Relationship (ER) Diagram
          </h2>
          <p className="text-xs text-stone-600 dark:text-zinc-400 max-w-2xl mt-1 leading-relaxed">
            Click on <span className="text-emerald-600 dark:text-emerald-400 font-bold">any table node</span> to trigger the animated Argument Explorer modal with full field specifications, relational cascades, and live JSON generators.
          </p>
        </div>

        {/* Domain Filter Pills (Fixed High Contrast in Light & Dark Mode) */}
        <div className={`flex flex-wrap gap-1.5 p-1.5 rounded-xl border shadow-sm shrink-0 ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-stone-200 border-stone-300'
        }`}>
          {[
            { id: 'all', label: 'All Models (14)' },
            { id: 'core', label: 'Core Jobs & DAGs' },
            { id: 'governance', label: 'Queues & Cron' },
            { id: 'worker', label: 'Worker Fleet' },
            { id: 'tenant', label: 'Multi-Tenant' },
          ].map((tab) => {
            const isActive = domainFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setDomainFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-extrabold'
                    : isDark
                    ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                    : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300/80 font-bold'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SVG ER DIAGRAM CANVAS */}
      <div className={`rounded-2xl border ${
        isDark ? 'bg-[#08090d] border-zinc-800' : 'bg-[#FAF8F5] border-[#D9D3C7]'
      } shadow-2xl overflow-hidden relative transition-colors`}>
        {/* Canvas Status Header */}
        <div className={`px-6 py-3 border-b ${
          isDark ? 'bg-zinc-900/40 border-zinc-800/80 text-zinc-400' : 'bg-[#EDE8DC] border-[#D9D3C7] text-stone-700 font-bold'
        } flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            PostgreSQL 16 Engine • 3NF Normalized Architecture • Click any table to inspect
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold"><Key className="w-3.5 h-3.5" /> PK = Primary Key</span>
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold"><Layers className="w-3.5 h-3.5" /> FK = Foreign Key</span>
          </div>
        </div>

        {/* SVG Drawing */}
        <div className="p-4 sm:p-6 overflow-x-auto select-none">
          <svg viewBox="0 0 1140 730" className="w-full min-w-[950px] h-auto font-sans">
            <defs>
              <filter id="er-glow-active" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Pattern */}
            <pattern id="er-grid-theme" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'} />
            </pattern>
            <rect width="1140" height="730" fill="url(#er-grid-theme)" />

            {/* RELATIONAL CONNECTOR EDGES */}
            <path d="M 200 95 L 240 95" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 410 95 L 460 95" stroke="#3b82f6" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 555 200 L 555 170" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" />
            <path d="M 410 75 L 700 75" stroke="#ec4899" strokeWidth="1.5" strokeDasharray="5 3" />
            <path d="M 555 170 L 555 350" stroke="#10b981" strokeWidth="3" strokeDasharray="6 3" className="animate-dash" filter="url(#er-glow-active)" />
            <path d="M 460 410 L 410 410" stroke="#a855f7" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 660 410 L 710 410" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 900 410 L 940 410" stroke="#71717a" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 555 510 L 555 560" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="6 3" className="animate-dash" />
            <path d="M 805 560 L 805 490" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 900 625 L 940 625" stroke="#eab308" strokeWidth="2" strokeDasharray="5 3" className="animate-dash" />
            <path d="M 325 150 L 325 560" stroke="#f97316" strokeWidth="1.5" strokeDasharray="5 3" />

            {/* TABLE ENTITY NODES */}
            {Object.keys(tables).map((tblKey) => {
              const table = tables[tblKey as TableEntityKey];
              const pos = nodePositions[tblKey as TableEntityKey];
              const isSelected = selectedTable === tblKey;
              const isHovered = hoveredTable === tblKey;
              const isDimmed = domainFilter !== 'all' && table.domain !== domainFilter;

              const cardBg = isDark ? (isSelected ? '#121b18' : '#12131a') : (isSelected ? '#FFFFFF' : '#FFFFFF');
              const headerBg = isDark ? (isSelected ? '#192823' : '#1a1c27') : (isSelected ? '#D1FAE5' : '#ECE7DA');
              const borderStroke = isSelected ? '#10b981' : isHovered ? '#38bdf8' : (isDark ? '#262837' : '#D9D3C7');
              const titleColor = isDark ? (isSelected ? '#6ee7b7' : '#f4f4f5') : (isSelected ? '#065f46' : '#1C1917');

              return (
                <g
                  key={tblKey}
                  onClick={() => {
                    setSelectedTable(tblKey as TableEntityKey);
                    setModalOpen(true);
                  }}
                  onMouseEnter={() => setHoveredTable(tblKey as TableEntityKey)}
                  onMouseLeave={() => setHoveredTable(null)}
                  className={`cursor-pointer transition-all duration-200 ${
                    isDimmed ? 'opacity-20' : 'opacity-100'
                  }`}
                >
                  {/* Table Outer Card */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height={pos.height}
                    rx="10"
                    fill={cardBg}
                    stroke={borderStroke}
                    strokeWidth={isSelected ? '3' : isHovered ? '2' : '1.5'}
                    filter={isSelected ? 'url(#er-glow-active)' : undefined}
                  />

                  {/* Header Bar */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height="28"
                    rx="10"
                    fill={headerBg}
                  />
                  <rect
                    x={pos.x}
                    y={pos.y + 18}
                    width={pos.width}
                    height="10"
                    fill={headerBg}
                  />

                  {/* Table Name */}
                  <text
                    x={pos.x + 10}
                    y={pos.y + 19}
                    fill={titleColor}
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
                        y={pos.y + 45 + idx * 18}
                        fill={col.isPk ? (isDark ? '#f59e0b' : '#b45309') : col.isFk ? (isDark ? '#60a5fa' : '#1d4ed8') : (isDark ? '#d4d4d8' : '#292524')}
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight={col.isPk || col.isFk ? 'bold' : 'normal'}
                      >
                        {col.isPk ? '🔑 ' : col.isFk ? '🔗 ' : '   '}
                        {col.name}
                      </text>
                      <text
                        x={pos.x + pos.width - 8}
                        y={pos.y + 45 + idx * 18}
                        fill={isDark ? '#a1a1aa' : '#78716c'}
                        fontSize="8.5"
                        fontFamily="monospace"
                        textAnchor="end"
                      >
                        {col.type.split(' ')[0]}
                      </text>
                    </g>
                  ))}

                  {/* "+ N more fields..." footer */}
                  {table.columns.length > 4 && (
                    <text
                      x={pos.x + 10}
                      y={pos.y + pos.height - 8}
                      fill={isDark ? '#34d399' : '#059669'}
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      + {table.columns.length - 4} more arguments ↗
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* QUICK TABLE PREVIEW CARD (Below Diagram) */}
      <div className={`rounded-2xl border ${
        isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-[#D9D3C7]'
      } shadow-xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              ACTIVE TABLE: {currentTable.schemaTable}
            </span>
            <span className="text-xs text-stone-600 dark:text-zinc-400 font-mono font-bold">
              {currentTable.columns.length} Arguments & Columns
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-stone-900 dark:text-zinc-100">
            {currentTable.name} Schema Specification
          </h3>
          <p className="text-xs text-stone-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
            {currentTable.description}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Open Argument & Schema Explorer</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
       * NEXT-LEVEL EXPANDED TABLE MODAL (ANIMATED GLASSMORPHIC DRAWER)
       * ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 animate-in fade-in duration-200">
          {/* Backdrop Blur Overlay */}
          <div
            onClick={() => setModalOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
          />

          {/* Modal Container */}
          <div className={`relative z-10 w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
            isDark ? 'bg-[#0f1016] border-zinc-800 text-white' : 'bg-[#FAF8F5] border-[#D9D3C7] text-stone-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-5 border-b ${
              isDark ? 'bg-zinc-900/80 border-zinc-800' : 'bg-[#EDE8DC] border-[#D9D3C7]'
            } flex items-center justify-between gap-4`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black tracking-tight">{currentTable.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {currentTable.badge}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-zinc-400 font-mono">
                    PostgreSQL Table: <span className="font-bold text-stone-900 dark:text-zinc-200">{currentTable.schemaTable}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className={`p-2 rounded-xl transition ${
                    isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-stone-300 text-stone-700 hover:text-stone-950'
                  }`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Sub-Navigation Bar */}
            <div className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-[#E3DDD0] border-[#D9D3C7]'
            }`}>
              {/* Tab Switchers */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'args', label: 'Arguments & Columns', icon: TableIcon, count: currentTable.columns.length },
                  { id: 'relations', label: 'Foreign Key Relations', icon: GitFork },
                  { id: 'indexes', label: 'B-Tree Indexes', icon: Code2, count: currentTable.indexes.length },
                  { id: 'json', label: 'Live JSON Mock', icon: Braces },
                  { id: 'prisma', label: 'Prisma Definition', icon: FileCode },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = modalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                          : isDark
                          ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                          : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200 font-bold'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                          isActive ? 'bg-black/20 text-white' : isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-stone-300 text-stone-900 font-bold'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Column Filter Input if on Arguments Tab */}
              {modalTab === 'args' && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-500 dark:text-zinc-400" />
                  <input
                    type="text"
                    value={columnSearch}
                    onChange={(e) => setColumnSearch(e.target.value)}
                    placeholder="Search column arguments..."
                    className={`pl-8 pr-3 py-1 rounded-lg text-xs font-mono border focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      isDark ? 'bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500' : 'bg-white border-stone-300 text-stone-900 placeholder-stone-400'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Modal Body: Tab Content Area */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
              {/* TAB 1: ARGUMENTS & COLUMNS */}
              {modalTab === 'args' && (
                <div className="space-y-4">
                  <div className={`overflow-x-auto rounded-2xl border ${
                    isDark ? 'border-zinc-800' : 'border-[#D9D3C7]'
                  }`}>
                    <table className="w-full text-left text-xs font-mono">
                      <thead className={isDark ? 'bg-zinc-900 text-zinc-300' : 'bg-[#E3DDD0] text-stone-900'}>
                        <tr>
                          <th className="p-3.5 font-bold">Argument / Field Name</th>
                          <th className="p-3.5 font-bold">PostgreSQL Data Type</th>
                          <th className="p-3.5 font-bold">Default Value</th>
                          <th className="p-3.5 font-bold">Keys & Constraints</th>
                          <th className="p-3.5 font-bold">Architectural Description</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${
                        isDark ? 'divide-zinc-800/80 text-zinc-300' : 'divide-[#E7E2D9] text-stone-800'
                      }`}>
                        {filteredColumns.map((col) => (
                          <tr key={col.name} className={`transition ${
                            isDark ? 'hover:bg-zinc-900/60' : 'hover:bg-[#F2EDE2]'
                          }`}>
                            <td className="p-3.5 font-bold flex items-center gap-2 text-stone-900 dark:text-zinc-100">
                              {col.isPk && <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {col.isFk && <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                              <span>{col.name}</span>
                            </td>
                            <td className="p-3.5 text-orange-600 dark:text-orange-400 font-bold">
                              {col.type}
                            </td>
                            <td className="p-3.5 text-stone-500 dark:text-zinc-400">
                              {col.defaultValue || '—'}
                            </td>
                            <td className="p-3.5">
                              <div className="flex flex-wrap gap-1">
                                {col.isPk && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                                    PRIMARY KEY
                                  </span>
                                )}
                                {col.isFk && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                                    FK → {col.fkTarget}
                                  </span>
                                )}
                                {col.isUnique && (
                                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-700 dark:text-purple-400 font-bold text-[10px]">
                                    UNIQUE
                                  </span>
                                )}
                                {col.isIndexed && !col.isPk && (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                    INDEXED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3.5 text-stone-700 dark:text-zinc-400">
                              {col.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Relational Invariants Card */}
                  <div className={`p-4 rounded-2xl border space-y-2 ${
                    isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-[#D9D3C7]'
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> High-Concurrency Invariants & Constraints
                    </h4>
                    <ul className="space-y-1.5">
                      {currentTable.invariants.map((inv, idx) => (
                        <li key={idx} className="text-xs flex items-start gap-2 text-stone-800 dark:text-zinc-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{inv}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB 2: RELATIONS & CASCADES */}
              {modalTab === 'relations' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Upstream Parents */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-[#D9D3C7]'
                    }`}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <span>↑</span> Upstream Parent Tables ({currentTable.relations.parents.length})
                      </h4>
                      {currentTable.relations.parents.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-zinc-400">Root table with no parent foreign key dependencies.</p>
                      ) : (
                        <div className="space-y-2 font-mono text-xs">
                          {currentTable.relations.parents.map((p, i) => (
                            <div key={i} className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                              <div className="font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                                <span>{p.table}</span>
                                <span className="text-[10px] text-stone-500 dark:text-zinc-400">Field: {p.field}</span>
                              </div>
                              <p className="text-[11px] text-stone-700 dark:text-zinc-300">Action: {p.onAction}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Downstream Children */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${
                      isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-[#D9D3C7]'
                    }`}>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
                        <span>↓</span> Downstream Child Tables ({currentTable.relations.children.length})
                      </h4>
                      {currentTable.relations.children.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-zinc-400">Leaf table with no cascading children.</p>
                      ) : (
                        <div className="space-y-2 font-mono text-xs">
                          {currentTable.relations.children.map((c, i) => (
                            <div key={i} className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                              <div className="font-bold text-purple-700 dark:text-purple-400 flex items-center justify-between">
                                <span>{c.table}</span>
                                <span className="text-[10px] text-stone-500 dark:text-zinc-400">Field: {c.field}</span>
                              </div>
                              <p className="text-[11px] text-stone-700 dark:text-zinc-300">Action: {c.onAction}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: B-TREE INDEXES */}
              {modalTab === 'indexes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 uppercase tracking-wider">
                      Composite Indexes & Query Optimization
                    </h4>
                    <button
                      onClick={() => copyToClipboard(currentTable.indexes.join('\n'), 'indexes')}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-xs font-mono transition"
                    >
                      {copiedText === 'indexes' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'indexes' ? 'Copied SQL' : 'Copy All Indexes'}</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentTable.indexes.map((idx, i) => (
                      <pre key={i} className="p-4 rounded-xl bg-stone-900 text-emerald-400 font-mono text-xs border border-stone-800 shadow-inner overflow-x-auto">
                        <code>{idx}</code>
                      </pre>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: LIVE JSON MOCK */}
              {modalTab === 'json' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 uppercase tracking-wider">
                      Sample Payload & Serialization
                    </h4>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(currentTable.mockData, null, 2), 'json')}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-xs font-mono transition"
                    >
                      {copiedText === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'json' ? 'Copied JSON' : 'Copy JSON'}</span>
                    </button>
                  </div>

                  <pre className="p-5 rounded-2xl bg-stone-950 text-amber-300 font-mono text-xs border border-stone-800 shadow-inner overflow-x-auto">
                    <code>{JSON.stringify(currentTable.mockData, null, 2)}</code>
                  </pre>
                </div>
              )}

              {/* TAB 5: PRISMA MODEL CODE */}
              {modalTab === 'prisma' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 uppercase tracking-wider">
                      Prisma Schema Definition (`schema.prisma`)
                    </h4>
                    <button
                      onClick={() => copyToClipboard(currentTable.prismaCode, 'prisma')}
                      className="flex items-center gap-1.5 px-3 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-xs font-mono transition"
                    >
                      {copiedText === 'prisma' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'prisma' ? 'Copied Prisma' : 'Copy Prisma Code'}</span>
                    </button>
                  </div>

                  <pre className="p-5 rounded-2xl bg-stone-950 text-cyan-300 font-mono text-xs border border-stone-800 shadow-inner overflow-x-auto">
                    <code>{currentTable.prismaCode}</code>
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
