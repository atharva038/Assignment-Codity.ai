import React, { useState, useEffect } from 'react';
import {
  Network,
  Cpu,
  Database,
  Radio,
  Server,
  Zap,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  Code2,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  Layers,
  GitMerge,
  Split,
  Sparkles,
  Info,
  Terminal,
  Activity,
  Maximize2,
  Workflow,
  Flame,
  FileCode,
  Copy,
  Check,
} from 'lucide-react';
import { DatabaseErDiagram } from './DatabaseErDiagram.js';

export interface ArchitectureViewProps {
  onRefresh?: () => void;
}

type SectionViewType = 'all' | 'topology' | 'er_diagram' | 'simulators' | 'tradeoffs';
type ScenarioType = 'skip_locked' | 'crash_reaper' | 'cron_lock' | 'retry_jitter' | 'dag_workflow' | 'sharding';
type ActiveNodeKey = 'ingress' | 'api' | 'postgres' | 'redis' | 'workers' | 'scheduler' | 'dlq';

export const ArchitectureView: React.FC<ArchitectureViewProps> = () => {
  const [activeSection, setActiveSection] = useState<SectionViewType>('all');
  const [selectedNode, setSelectedNode] = useState<ActiveNodeKey>('postgres');
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('skip_locked');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simStep, setSimStep] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Interactive Retry Simulation State
  const [retryAttempt, setRetryAttempt] = useState<number>(2);
  const [baseDelay, setBaseDelay] = useState<number>(1000);
  const [jitterFactor, setJitterFactor] = useState<number>(0.1);

  // Interactive DAG Step State
  const [dagStep, setDagStep] = useState<number>(1);

  // Sharding Simulator State
  const [testQueueName, setTestQueueName] = useState<string>('email-notifications');

  // Auto-advance scenario simulation
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimStep((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [isPlaying, activeScenario]);

  // FNV-1a Hash Calculator
  const computeFnv1aHash = (str: string): number => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash >>> 0);
  };
  const shardId = computeFnv1aHash(testQueueName) % 2;

  // Retry Math Calculation
  const expDelay = Math.min(60000, baseDelay * Math.pow(2, Math.max(0, retryAttempt - 1)));
  const jitterRange = expDelay * jitterFactor;
  const minDelay = Math.round(expDelay - jitterRange);
  const maxDelay = Math.round(expDelay + jitterRange);

  // Node details dictionary for interactive SVG inspector
  const nodeDetails: Record<ActiveNodeKey, {
    title: string;
    badge: string;
    color: string;
    description: string;
    tech: string;
    responsibilities: string[];
    sqlOrCode: string;
    engineeringRationale: string;
  }> = {
    ingress: {
      title: 'External Ingress & Client Layer',
      badge: 'HTTP / WSS / HMAC',
      color: 'from-blue-500 to-indigo-600',
      description: 'Unified client entry points handling Web UI telemetry, external REST integrations, and cryptographically verified inbound webhooks.',
      tech: 'React 18 Dashboard + Postman / SDKs + Inbound Webhooks',
      responsibilities: [
        'Real-time bidirectional WebSocket streaming (/ws)',
        'HMAC-SHA256 signature verification for inbound payment/build webhooks',
        'Multi-tenant JWT token transport & authentication',
      ],
      sqlOrCode: `// Timing-safe HMAC signature verification
const expectedSig = crypto.createHmac('sha256', secret)
  .update(rawBody).digest('hex');
const isValid = crypto.timingSafeEqual(
  Buffer.from(signature), Buffer.from(expectedSig)
);`,
      engineeringRationale: 'Uses timingSafeEqual to prevent side-channel timing attacks on webhook signature comparisons.',
    },
    api: {
      title: 'API Gateway & Ingress Layer (`apps/api`)',
      badge: 'Port 3000 • Express + Zod',
      color: 'from-purple-500 to-indigo-600',
      description: 'Validates request schemas, extracts tenant identity, executes sliding window rate limiting, and guarantees job idempotency before database mutations.',
      tech: 'Express.js 4 + TypeScript + Zod + JWT + WebSocket Server',
      responsibilities: [
        'Zod schema validation on single, delayed, and bulk job requests',
        'Redis Sliding Window Rate Limiting (ZSET) with in-memory fallback',
        'Idempotency key deduplication (SELECT WHERE idempotencyKey = $key)',
        'Redis Pub/Sub real-time WebSocket broadcasting',
      ],
      sqlOrCode: `// Atomic Idempotency Check & Ingestion
const existing = await prisma.job.findUnique({
  where: { queueId_idempotencyKey: { queueId, idempotencyKey } }
});
if (existing) return res.status(200).json({ ...existing, deduplicated: true });

const newJob = await prisma.job.create({
  data: { queueId, type, payload, priority, availableAt }
});`,
      engineeringRationale: 'Guarantees that network retries or identical webhook retries from upstream services never create duplicate execution jobs.',
    },
    postgres: {
      title: 'PostgreSQL 16 Engine (`packages/database`)',
      badge: 'ACID • FOR UPDATE SKIP LOCKED',
      color: 'from-emerald-500 to-teal-600',
      description: 'The single source of truth for the entire cluster. Uses native row-level locking to guarantee lock-free, zero-contention parallel claiming.',
      tech: 'PostgreSQL 16 + Prisma ORM + Multi-Column B-Tree Indexes',
      responsibilities: [
        'Atomic single-row claiming via SELECT ... FOR UPDATE SKIP LOCKED',
        'B-Tree Indexing on (queueId, status, priority, availableAt)',
        'Foreign key integrity with cascading restricts on active queues',
        '1:1 DeadLetterJob relational mapping for audit retention',
      ],
      sqlOrCode: `-- Atomic High-Concurrency Job Claiming Query
BEGIN;
SELECT id, "queueId", "type", "payload", "priority", "attempts"
FROM "jobs"
WHERE "queueId" = $1 
  AND "status" = 'QUEUED'::"JobStatus"
  AND "availableAt" <= NOW()
ORDER BY "priority" DESC, "availableAt" ASC
LIMIT $2
FOR UPDATE SKIP LOCKED;

UPDATE "jobs"
SET "status" = 'RUNNING'::"JobStatus",
    "lockedBy" = $3,
    "lockedUntil" = NOW() + INTERVAL '60 seconds'
WHERE "id" = $jobId;
COMMIT;`,
      engineeringRationale: 'SKIP LOCKED eliminates distributed lock deadlocks (e.g. Redlock) and achieves 100% ACID consistency without split-brain risk.',
    },
    redis: {
      title: 'Redis 7 Cache & Telemetry Bus (`packages/redis`)',
      badge: 'Port 6379 • Pub/Sub + ZSET',
      color: 'from-rose-500 to-red-600',
      description: 'High-speed in-memory engine powering sliding window rate limiting logs, worker heartbeat caches, and cross-process telemetry broadcasts.',
      tech: 'Redis 7.0 + ioredis with Auto-Reconnect Backoff',
      responsibilities: [
        'Pub/Sub event bus for live job status transitions and terminal logs',
        'Sliding window log rate limiting with millisecond ZSET timestamps',
        'Worker fleet heartbeat caching and load distribution',
      ],
      sqlOrCode: `// Redis Sliding Window Rate Limiting Algorithm
const key = \`ratelimit:\${tenantId}\`;
const now = Date.now();
const windowStart = now - windowMs;

await redis.zremrangebyscore(key, 0, windowStart);
const currentCount = await redis.zcard(key);

if (currentCount >= maxRequests) {
  return { allowed: false, retryAfterMs: ... };
}
await redis.zadd(key, now, \`\${now}-\${randomUUID()}\`);`,
      engineeringRationale: 'Provides microsecond telemetry streaming without burdening PostgreSQL with transient UI polling queries.',
    },
    workers: {
      title: 'Worker Fleet Execution Engine (`apps/worker`)',
      badge: 'Concurrent Poller • Sandboxed Handlers',
      color: 'from-amber-500 to-orange-600',
      description: 'Distributed worker daemon executing concurrent polling loops, sandboxed task runners, microsecond log capture, and exponential backoff retry math.',
      tech: 'Node.js 20+ Worker Fleet + Pino Logger',
      responsibilities: [
        'Concurrent queue polling bounded by WORKER_CONCURRENCY',
        'Pluggable handler execution (Email, PDF, Webhooks, AI Summaries)',
        'Exponential backoff calculation with +/-10% decorrelated jitter',
        'Emits CPU, RAM, and active job telemetry heartbeats every 5s',
      ],
      sqlOrCode: `// Exponential Backoff with Decorrelated Jitter
const rawDelay = Math.min(policy.maxDelayMs, 
  policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1)
);
const jitter = rawDelay * (Math.random() * 0.20 - 0.10); // +/- 10%
const nextAvailableAt = new Date(Date.now() + rawDelay + jitter);

await prisma.job.update({
  where: { id: job.id },
  data: { status: 'RETRYING', availableAt: nextAvailableAt, lockedBy: null }
});`,
      engineeringRationale: 'Full jitter ensures that 10,000 retrying jobs do not synchronize and create thundering herd spikes on downstream databases.',
    },
    scheduler: {
      title: 'Scheduler & Crash Recovery Reaper (`apps/scheduler`)',
      badge: 'Cron Engine • Delayed Promoter • Reaper',
      color: 'from-red-500 to-rose-600',
      description: 'High-availability coordination daemon that evaluates 5-field cron expressions with optimistic locks, promotes delayed jobs, and recovers orphaned job leases.',
      tech: 'Node.js Process + Optimistic SQL Locking',
      responsibilities: [
        'Cron evaluation with optimistic lockToken to prevent duplicate triggers',
        'Promotes SCHEDULED jobs to QUEUED when availableAt <= NOW()',
        'Crash Reaper: detects silent workers (>30s) and recovers orphaned leases',
        'DAG Workflow Resolver: decrements parent counters on completion',
      ],
      sqlOrCode: `// Multi-Replica Optimistic Cron Lock
const acquired = await prisma.$executeRaw\`
  UPDATE "scheduled_jobs"
  SET "lockToken" = \${schedulerId},
      "lockExpiresAt" = NOW() + INTERVAL '30 seconds'
  WHERE "id" = \${cronJob.id}
    AND ("lockToken" IS NULL OR "lockExpiresAt" < NOW());
\`;
if (acquired === 1) {
  // Safe to spawn job: this replica won the election!
  await spawnJobFromCron(cronJob);
}`,
      engineeringRationale: 'Guarantees exactly one job is spawned per cron tick even when multiple scheduler replicas run concurrently in high-availability mode.',
    },
    dlq: {
      title: 'Dead Letter Queue & Audit Engine',
      badge: '1:1 Audit FK • One-Click Replay',
      color: 'from-rose-600 to-pink-600',
      description: 'Permanent isolation chamber for jobs that exhausted all retry attempts. Preserves full context, stack traces, and historical attempt logs with one-click replay.',
      tech: 'PostgreSQL Relational FK + Replay REST Endpoint',
      responsibilities: [
        'Captures final exception message, stack trace, and execution duration',
        'Preserves immutable 1:1 foreign key reference to the original Job row',
        'Provides atomic replay capability (resets attempts=0 and status=QUEUED)',
      ],
      sqlOrCode: `// DLQ Isolation & Atomic Replay
// 1. Move to DeadLetterJob
await prisma.deadLetterJob.create({
  data: { jobId: job.id, failureReason: err.message, stackTrace: err.stack }
});
await prisma.job.update({
  where: { id: job.id },
  data: { status: 'DEAD', failedAt: new Date() }
});

// 2. Replay Action
await prisma.job.update({
  where: { id: job.id },
  data: { status: 'QUEUED', attempts: 0, availableAt: new Date(), lockedBy: null }
});`,
      engineeringRationale: 'Maintains complete regulatory auditability without losing payload data or execution telemetry when jobs permanently fail.',
    },
  };

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-16">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 border border-stone-800 dark:border-zinc-800 p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
              Core Infrastructure Specification • Distributed Architecture
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Interactive System Architecture & Live Concurrency Visualizer
            </h1>
            <p className="text-sm text-stone-300 dark:text-zinc-400 max-w-3xl leading-relaxed">
              Explore the end-to-end topological layout, PostgreSQL ER schema, atomic <code className="text-orange-300 bg-black/40 px-1.5 py-0.5 rounded font-mono text-xs">FOR UPDATE SKIP LOCKED</code> claiming, crash recovery loops, DAG workflows, and retry jitter mathematics.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs shadow-lg transition-all ${
                isPlaying
                  ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause Animation' : 'Resume Animation'}
            </button>
          </div>
        </div>
      </div>

      {/* ARCHITECTURE SECTION SELECTOR BAR */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
        {[
          { id: 'all', label: 'All Architecture Sections', icon: Layers },
          { id: 'topology', label: '1. Master System Topology', icon: Network },
          { id: 'er_diagram', label: '2. Relational Database ER Diagram', icon: Database },
          { id: 'simulators', label: '3. Concurrency Simulators', icon: Activity },
          { id: 'tradeoffs', label: '4. Trade-Offs & Rationale', icon: ShieldCheck },
        ].map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as SectionViewType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                  : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 hover:bg-stone-200/60 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* MASTER TOPOLOGY: Interactive Animated SVG Architecture Diagram */}
      {(activeSection === 'all' || activeSection === 'topology') && (
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Live System Topology & Data Bus</h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Click any component to inspect internal SQL, invariants, and failure handling</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500 dark:text-zinc-400">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Pipeline Bus • High Concurrency Mode
          </div>
        </div>

        {/* SVG Canvas with Clean Layout & Glowing Nodes */}
        <div className="p-4 sm:p-6 bg-[#090a0f] relative overflow-x-auto select-none">
          <svg viewBox="0 0 1140 500" className="w-full min-w-[900px] h-auto font-sans">
            <defs>
              <linearGradient id="grad-client" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="grad-api" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
              <linearGradient id="grad-db" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
              <linearGradient id="grad-redis" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#b91c1c" />
              </linearGradient>
              <linearGradient id="grad-worker" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="grad-sched" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#be185d" />
              </linearGradient>

              <filter id="glow-bright" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Pattern */}
            <pattern id="grid-dots" width="30" height="30" patternUnits="userSpaceOnUse">
              <circle cx="15" cy="15" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
            <rect width="1140" height="500" fill="url(#grid-dots)" />

            {/* CONNECTION PATHS */}
            {/* 1. Dashboard to API Gateway */}
            <path d="M 200 110 L 270 170" stroke="#60a5fa" strokeWidth="2" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />
            {/* 2. Webhooks to API Gateway */}
            <path d="M 200 250 L 270 190" stroke="#a78bfa" strokeWidth="2" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />
            
            {/* 3. API Gateway to PostgreSQL */}
            <path d="M 450 160 L 530 110" stroke="#34d399" strokeWidth="2.5" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />
            
            {/* 4. API Gateway to Redis */}
            <path d="M 360 235 L 360 320" stroke="#f87171" strokeWidth="2" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />
            
            {/* 5. PostgreSQL to Worker Fleet (SKIP LOCKED) */}
            <path d="M 635 190 L 635 300" stroke="#fbbf24" strokeWidth="3" strokeDasharray="8 4" className={isPlaying ? 'animate-dash' : ''} filter="url(#glow-bright)" />
            
            {/* 6. PostgreSQL to Scheduler */}
            <path d="M 740 110 L 830 110" stroke="#f472b6" strokeWidth="2.5" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />

            {/* 7. Redis to Worker Fleet */}
            <path d="M 450 380 L 530 380" stroke="#fb923c" strokeWidth="2" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />

            {/* 8. Worker Fleet to Dead Letter Queue */}
            <path d="M 740 370 L 830 370" stroke="#f43f5e" strokeWidth="2.5" strokeDasharray="6 4" className={isPlaying ? 'animate-dash' : ''} />

            {/* Flowing animated circles along path if active */}
            {isPlaying && (
              <>
                <circle cx="235" cy="140" r="4" fill="#93c5fd">
                  <animate attributeName="cx" from="200" to="270" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="cy" from="110" to="170" dur="1.4s" repeatCount="indefinite" />
                </circle>
                <circle cx="490" cy="135" r="4.5" fill="#6ee7b7">
                  <animate attributeName="cx" from="450" to="530" dur="1.2s" repeatCount="indefinite" />
                  <animate attributeName="cy" from="160" to="110" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="635" cy="245" r="5" fill="#fde047" filter="url(#glow-bright)">
                  <animate attributeName="cy" from="190" to="300" dur="1.0s" repeatCount="indefinite" />
                </circle>
                <circle cx="360" cy="275" r="4" fill="#fca5a5">
                  <animate attributeName="cy" from="235" to="320" dur="1.3s" repeatCount="indefinite" />
                </circle>
                <circle cx="490" cy="380" r="4" fill="#fdba74">
                  <animate attributeName="cx" from="450" to="530" dur="1.2s" repeatCount="indefinite" />
                </circle>
                <circle cx="785" cy="110" r="4" fill="#f472b6">
                  <animate attributeName="cx" from="740" to="830" dur="1.3s" repeatCount="indefinite" />
                </circle>
                <circle cx="785" cy="370" r="4" fill="#fda4af">
                  <animate attributeName="cx" from="740" to="830" dur="1.3s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Labels on Interconnects */}
            <rect x="580" y="235" width="110" height="20" rx="4" fill="#18181b" stroke="#fbbf24" strokeWidth="0.8" />
            <text x="635" y="249" fill="#fde047" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">SKIP LOCKED</text>

            <rect x="755" y="98" width="60" height="18" rx="4" fill="#18181b" stroke="#f472b6" strokeWidth="0.8" />
            <text x="785" y="111" fill="#f472b6" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">LOCK TOKEN</text>

            {/* NODE 1: Ingress & Clients */}
            <g
              onClick={() => setSelectedNode('ingress')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="30" y="60" width="170" height="95" rx="12" fill="#121318" stroke={selectedNode === 'ingress' ? '#3b82f6' : '#27272a'} strokeWidth={selectedNode === 'ingress' ? '3' : '1.5'} />
              <rect x="30" y="60" width="170" height="95" rx="12" fill="url(#grad-client)" fillOpacity="0.12" />
              <text x="45" y="88" fill="#93c5fd" fontSize="13" fontWeight="bold">🖥️ React Dashboard</text>
              <text x="45" y="108" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Port 5173 • Recharts</text>
              <text x="45" y="126" fill="#60a5fa" fontSize="9" fontFamily="monospace">Dual-Mode Transport</text>
            </g>

            <g
              onClick={() => setSelectedNode('ingress')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="30" y="200" width="170" height="95" rx="12" fill="#121318" stroke={selectedNode === 'ingress' ? '#8b5cf6' : '#27272a'} strokeWidth={selectedNode === 'ingress' ? '3' : '1.5'} />
              <text x="45" y="228" fill="#c4b5fd" fontSize="13" fontWeight="bold">🔔 Webhooks & SDKs</text>
              <text x="45" y="248" fill="#a1a1aa" fontSize="10" fontFamily="monospace">HMAC SHA-256 Auth</text>
              <text x="45" y="266" fill="#a78bfa" fontSize="9" fontFamily="monospace">Idempotent Ingestion</text>
            </g>

            {/* NODE 2: Express API Gateway */}
            <g
              onClick={() => setSelectedNode('api')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="270" y="120" width="180" height="115" rx="12" fill="#121318" stroke={selectedNode === 'api' ? '#8b5cf6' : '#3f3f46'} strokeWidth={selectedNode === 'api' ? '3' : '1.5'} />
              <rect x="270" y="120" width="180" height="115" rx="12" fill="url(#grad-api)" fillOpacity="0.15" />
              <text x="285" y="148" fill="#c4b5fd" fontSize="13" fontWeight="bold">🌐 Express API Gateway</text>
              <text x="285" y="170" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Port 3000 • Zod Val</text>
              <text x="285" y="190" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Sliding Rate Limiter</text>
              <text x="285" y="210" fill="#a78bfa" fontSize="9" fontFamily="monospace">WebSocket Gateway</text>
            </g>

            {/* NODE 3: Redis 7 Cache & PubSub */}
            <g
              onClick={() => setSelectedNode('redis')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="270" y="320" width="180" height="115" rx="12" fill="#121318" stroke={selectedNode === 'redis' ? '#ef4444' : '#3f3f46'} strokeWidth={selectedNode === 'redis' ? '3' : '1.5'} />
              <rect x="270" y="320" width="180" height="115" rx="12" fill="url(#grad-redis)" fillOpacity="0.15" />
              <text x="285" y="348" fill="#fca5a5" fontSize="13" fontWeight="bold">🔴 Redis 7 Cache / Bus</text>
              <text x="285" y="370" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Pub/Sub Event Stream</text>
              <text x="285" y="390" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Sliding Window Logs</text>
              <text x="285" y="410" fill="#f87171" fontSize="9" fontFamily="monospace">Heartbeat Caching</text>
            </g>

            {/* NODE 4: PostgreSQL 16 (CENTER OF ARCHITECTURE) */}
            <g
              onClick={() => setSelectedNode('postgres')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="530" y="50" width="210" height="140" rx="14" fill="#121318" stroke={selectedNode === 'postgres' ? '#10b981' : '#059669'} strokeWidth={selectedNode === 'postgres' ? '3.5' : '2'} filter={selectedNode === 'postgres' ? 'url(#glow-bright)' : ''} />
              <rect x="530" y="50" width="210" height="140" rx="14" fill="url(#grad-db)" fillOpacity="0.18" />
              <text x="548" y="80" fill="#6ee7b7" fontSize="14" fontWeight="bold">🗄️ PostgreSQL 16</text>
              <text x="548" y="102" fill="#fef08a" fontSize="11" fontWeight="bold" fontFamily="monospace">⚡ FOR UPDATE</text>
              <text x="548" y="118" fill="#fef08a" fontSize="11" fontWeight="bold" fontFamily="monospace">   SKIP LOCKED</text>
              <text x="548" y="140" fill="#a1a1aa" fontSize="10" fontFamily="monospace">B-Tree Indexes • 3NF</text>
              <text x="548" y="160" fill="#34d399" fontSize="10" fontFamily="monospace">ACID Single Source</text>
            </g>

            {/* NODE 5: Worker Fleet Execution Pool */}
            <g
              onClick={() => setSelectedNode('workers')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="530" y="300" width="210" height="140" rx="14" fill="#121318" stroke={selectedNode === 'workers' ? '#f59e0b' : '#3f3f46'} strokeWidth={selectedNode === 'workers' ? '3' : '1.5'} />
              <rect x="530" y="300" width="210" height="140" rx="14" fill="url(#grad-worker)" fillOpacity="0.15" />
              <text x="548" y="330" fill="#fde047" fontSize="13" fontWeight="bold">⚙️ Worker Fleet</text>
              <text x="548" y="352" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Atomic SKIP Poller</text>
              <text x="548" y="372" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Concurrency Limit: 5</text>
              <text x="548" y="392" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Jitter Retry + Handlers</text>
              <text x="548" y="412" fill="#fbbf24" fontSize="9" fontFamily="monospace">Telemetry Heartbeat (5s)</text>
            </g>

            {/* NODE 6: Scheduler & Reaper */}
            <g
              onClick={() => setSelectedNode('scheduler')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="830" y="50" width="210" height="140" rx="14" fill="#121318" stroke={selectedNode === 'scheduler' ? '#ec4899' : '#3f3f46'} strokeWidth={selectedNode === 'scheduler' ? '3' : '1.5'} />
              <rect x="830" y="50" width="210" height="140" rx="14" fill="url(#grad-sched)" fillOpacity="0.15" />
              <text x="848" y="80" fill="#f472b6" fontSize="13" fontWeight="bold">⏰ Scheduler &</text>
              <text x="848" y="98" fill="#f472b6" fontSize="13" fontWeight="bold">💀 Crash Reaper</text>
              <text x="848" y="120" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Cron Optimistic Lock</text>
              <text x="848" y="140" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Promoter (NOW())</text>
              <text x="848" y="160" fill="#f472b6" fontSize="9" fontFamily="monospace">Reclaims Stale Leases</text>
            </g>

            {/* NODE 7: Dead Letter Queue */}
            <g
              onClick={() => setSelectedNode('dlq')}
              className="cursor-pointer transition-transform hover:scale-[1.01]"
            >
              <rect x="830" y="300" width="210" height="140" rx="14" fill="#121318" stroke={selectedNode === 'dlq' ? '#f43f5e' : '#3f3f46'} strokeWidth={selectedNode === 'dlq' ? '3' : '1.5'} />
              <text x="848" y="330" fill="#fb7185" fontSize="13" fontWeight="bold">⚠️ Dead Letter (DLQ)</text>
              <text x="848" y="352" fill="#a1a1aa" fontSize="10" fontFamily="monospace">1:1 Job Relational FK</text>
              <text x="848" y="372" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Preserves Log Stream</text>
              <text x="848" y="392" fill="#a1a1aa" fontSize="10" fontFamily="monospace">Failure Stack Traces</text>
              <text x="848" y="412" fill="#fda4af" fontSize="9" fontFamily="monospace">One-Click Replay</text>
            </g>
          </svg>
        </div>

        {/* Selected Component Deep-Dive Card */}
        <div className="p-6 bg-stone-50/50 dark:bg-zinc-900 border-t border-stone-200 dark:border-zinc-800">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col: Spec & Responsibilities */}
            <div className="lg:col-span-1 space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {nodeDetails[selectedNode].badge}
                </span>
                <span className="text-xs text-stone-500 dark:text-zinc-400 font-mono">Component Inspector</span>
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-zinc-100">{nodeDetails[selectedNode].title}</h3>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">{nodeDetails[selectedNode].description}</p>
              
              <div className="pt-2">
                <h4 className="text-xs font-semibold text-stone-900 dark:text-zinc-200 uppercase tracking-wider mb-2">Core Responsibilities</h4>
                <ul className="space-y-1.5">
                  {nodeDetails[selectedNode].responsibilities.map((r, i) => (
                    <li key={i} className="text-xs text-stone-600 dark:text-zinc-400 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Middle Col: Production Code / SQL Query */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-mono font-semibold text-stone-700 dark:text-zinc-300">Production Code & SQL Implementation</span>
                </div>
                <button
                  onClick={() => copyCode(nodeDetails[selectedNode].sqlOrCode)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-xs text-stone-700 dark:text-zinc-300 hover:bg-stone-300 dark:hover:bg-zinc-700 transition"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-stone-900 text-stone-100 font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800 shadow-inner">
                <code>{nodeDetails[selectedNode].sqlOrCode}</code>
              </pre>

              <div className="p-3 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-xs text-orange-950 dark:text-orange-200 flex items-start gap-2.5">
                <BookOpen className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Engineering Rationale: </span>
                  {nodeDetails[selectedNode].engineeringRationale}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* RELATIONAL DATABASE ER DIAGRAM (POSTGRESQL 16) */}
      {(activeSection === 'all' || activeSection === 'er_diagram') && (
        <DatabaseErDiagram />
      )}

      {/* INTERACTIVE SCENARIO SIMULATION LAB */}
      {(activeSection === 'all' || activeSection === 'simulators') && (
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl overflow-hidden">
        {/* Scenario Tabs */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Interactive Concurrency & Failure Simulators</h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">Run animated step-by-step simulations of critical architectural guarantees</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: 'skip_locked', label: '1. Atomic SKIP LOCKED Race', icon: Lock },
              { id: 'crash_reaper', label: '2. Crash Recovery Reaper', icon: AlertTriangle },
              { id: 'cron_lock', label: '3. Optimistic Cron Lock', icon: Clock },
              { id: 'retry_jitter', label: '4. Retry Jitter Curve', icon: RotateCcw },
              { id: 'dag_workflow', label: '5. DAG Fan-Out / Fan-In', icon: GitMerge },
              { id: 'sharding', label: '6. FNV-1a Shard Ring', icon: Split },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveScenario(tab.id as ScenarioType);
                    setSimStep(0);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeScenario === tab.id
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20 font-semibold'
                      : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SCENARIO 1: ATOMIC SKIP LOCKED RACE */}
        {activeScenario === 'skip_locked' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Scenario 1: Concurrent Workers Polling Same Queue Simultaneously
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Demonstrates how PostgreSQL skips Row 101 for Worker Beta with <span className="text-emerald-500 font-bold">0ms wait time</span> and <span className="text-emerald-500 font-bold">0 duplicate claims</span>.
                </p>
              </div>
              <button
                onClick={() => setSimStep((prev) => (prev + 1) % 4)}
                className="px-3.5 py-1.5 rounded-lg bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition shrink-0"
              >
                Step Forward (Step {simStep + 1}/4)
              </button>
            </div>

            {/* Visual Box Animation */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Worker Alpha */}
              <div className={`p-5 rounded-xl border transition-all ${
                simStep >= 1 ? 'border-orange-500 bg-orange-500/5 shadow-lg' : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-orange-500" />
                  <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Worker Alpha</h4>
                </div>
                <div className="text-xs font-mono space-y-1.5 text-stone-600 dark:text-zinc-400">
                  <p>1. BEGIN Transaction</p>
                  <p className={simStep >= 1 ? 'text-emerald-500 font-bold' : ''}>2. Acquires XMAX lock on Job #101</p>
                  <p className={simStep >= 2 ? 'text-orange-500 font-bold' : ''}>3. Status: RUNNING (lockedBy: Alpha)</p>
                  <p className={simStep >= 3 ? 'text-blue-500 font-bold' : ''}>4. COMMIT & Executes</p>
                </div>
              </div>

              {/* PostgreSQL Queue Table */}
              <div className="p-5 rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 text-center space-y-3">
                <Database className="w-6 h-6 text-emerald-500 mx-auto" />
                <h4 className="text-xs font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400">
                  PostgreSQL Job Table
                </h4>
                <div className="space-y-2 text-xs font-mono">
                  <div className={`p-2 rounded border transition ${
                    simStep >= 1 ? 'bg-orange-500/20 border-orange-500 text-orange-400 font-bold' : 'bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                  }`}>
                    Row #101: {simStep >= 1 ? '🔒 LOCKED by Alpha' : 'QUEUED (Priority: 20)'}
                  </div>
                  <div className={`p-2 rounded border transition ${
                    simStep >= 2 ? 'bg-purple-500/20 border-purple-500 text-purple-400 font-bold' : 'bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300'
                  }`}>
                    Row #102: {simStep >= 2 ? '🔒 LOCKED by Beta' : 'QUEUED (Priority: 10)'}
                  </div>
                </div>
              </div>

              {/* Worker Beta */}
              <div className={`p-5 rounded-xl border transition-all ${
                simStep >= 2 ? 'border-purple-500 bg-purple-500/5 shadow-lg' : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-purple-500" />
                  <h4 className="text-sm font-bold text-stone-900 dark:text-zinc-100">Worker Beta</h4>
                </div>
                <div className="text-xs font-mono space-y-1.5 text-stone-600 dark:text-zinc-400">
                  <p>1. BEGIN Transaction</p>
                  <p className={simStep >= 2 ? 'text-amber-500 font-bold' : ''}>2. SKIPS Row #101 (locked!)</p>
                  <p className={simStep >= 2 ? 'text-emerald-500 font-bold' : ''}>3. Acquires XMAX lock on Row #102</p>
                  <p className={simStep >= 3 ? 'text-purple-500 font-bold' : ''}>4. Status: RUNNING (lockedBy: Beta)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 2: CRASH RECOVERY REAPER */}
        {activeScenario === 'crash_reaper' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Scenario 2: Worker Sudden Termination (`kill -9`) & Lease Recovery
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Demonstrates how the background Reaper daemon detects stale workers (&gt;30s) and restores orphaned jobs with zero data loss.
                </p>
              </div>
              <button
                onClick={() => setSimStep((prev) => (prev + 1) % 4)}
                className="px-3.5 py-1.5 rounded-lg bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition shrink-0"
              >
                Advance Step ({simStep + 1}/4)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div className={`p-4 rounded-xl border ${simStep === 0 ? 'border-orange-500 bg-orange-500/10 font-bold' : 'border-stone-200 dark:border-zinc-800'}`}>
                <span className="text-orange-500 font-bold">1. Active Claim</span>
                <p className="mt-1 text-stone-600 dark:text-zinc-400">Worker PID 4092 claims Job #400 with lease duration 60s.</p>
              </div>
              <div className={`p-4 rounded-xl border ${simStep === 1 ? 'border-rose-500 bg-rose-500/10 font-bold text-rose-500' : 'border-stone-200 dark:border-zinc-800'}`}>
                <span>2. Hard Crash (`kill -9`)</span>
                <p className="mt-1 text-stone-600 dark:text-zinc-400">Worker process killed abruptly. Heartbeat terminates instantly.</p>
              </div>
              <div className={`p-4 rounded-xl border ${simStep === 2 ? 'border-amber-500 bg-amber-500/10 font-bold text-amber-500' : 'border-stone-200 dark:border-zinc-800'}`}>
                <span>3. Reaper Detection</span>
                <p className="mt-1 text-stone-600 dark:text-zinc-400">Reaper sweep identifies lastHeartbeat &gt; 30s & lease expired.</p>
              </div>
              <div className={`p-4 rounded-xl border ${simStep === 3 ? 'border-emerald-500 bg-emerald-500/10 font-bold text-emerald-500' : 'border-stone-200 dark:border-zinc-800'}`}>
                <span>4. Safe Reclamation</span>
                <p className="mt-1 text-stone-600 dark:text-zinc-400">Job #400 reset to QUEUED state. Zero data loss.</p>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 3: CRON OPTIMISTIC LOCK */}
        {activeScenario === 'cron_lock' && (
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              Scenario 3: Multi-Replica Distributed Cron Race Condition Guard
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              When 5 scheduler replicas wake up on the exact same second for <code className="text-orange-400 font-mono">0 * * * *</code>, only one can acquire the <code className="text-purple-400 font-mono">lockToken</code>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Scheduler Replica #1 (Winner)
                </div>
                <p className="text-stone-700 dark:text-zinc-300">UPDATE "CronSchedule" SET lockToken='s1', lockExpiresAt=NOW()+30s</p>
                <p className="text-emerald-500 font-bold">Result: Rows Affected = 1</p>
                <p className="text-stone-500 dark:text-zinc-400">Spawns exactly 1 job into target queue and updates lastRunAt.</p>
              </div>

              <div className="p-5 rounded-xl border border-rose-500/30 bg-rose-500/5 space-y-2">
                <div className="flex items-center gap-2 text-rose-500 font-bold">
                  <AlertTriangle className="w-4 h-4" />
                  Scheduler Replica #2 (Graceful Skip)
                </div>
                <p className="text-stone-700 dark:text-zinc-300">UPDATE "CronSchedule" SET lockToken='s2' WHERE lockToken IS NULL</p>
                <p className="text-rose-500 font-bold">Result: Rows Affected = 0</p>
                <p className="text-stone-500 dark:text-zinc-400">Terminates cron tick immediately. Zero duplicate jobs created!</p>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 4: RETRY JITTER CURVE */}
        {activeScenario === 'retry_jitter' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Scenario 4: Exponential Backoff & Decorrelated Jitter Calculator
                </h3>
                <p className="text-xs font-mono text-stone-500 dark:text-zinc-400">
                  Delay = min(maxDelay, base × 2^(attempt - 1)) ± 10% Jitter
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Attempt Number: {retryAttempt}</label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={retryAttempt}
                  onChange={(e) => setRetryAttempt(parseInt(e.target.value, 10))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Base Delay: {baseDelay} ms</label>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={baseDelay}
                  onChange={(e) => setBaseDelay(parseInt(e.target.value, 10))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 dark:text-zinc-300">Jitter Spread: ±{(jitterFactor * 100).toFixed(0)}%</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.25"
                  step="0.05"
                  value={jitterFactor}
                  onChange={(e) => setJitterFactor(parseFloat(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
            </div>

            {/* Result Visualizer Card */}
            <div className="p-5 rounded-xl border border-orange-500/30 bg-orange-500/5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">Calculated Exponential Delay</span>
                <div className="text-2xl font-black font-mono text-orange-500">{(expDelay / 1000).toFixed(2)}s ({expDelay} ms)</div>
              </div>
              <div>
                <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">Jitter Range Distribution</span>
                <div className="text-lg font-bold font-mono text-emerald-500">
                  {(minDelay / 1000).toFixed(2)}s ~ {(maxDelay / 1000).toFixed(2)}s
                </div>
              </div>
              <div className="text-xs text-stone-500 dark:text-zinc-400 max-w-xs">
                Prevents 10,000 retrying jobs from hitting your database at the exact same millisecond.
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 5: DAG WORKFLOW ENGINE */}
        {activeScenario === 'dag_workflow' && (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
                  Scenario 5: Directed Acyclic Graph (DAG) Fan-Out / Fan-In Resolution
                </h3>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  Downstream jobs stay <code className="text-purple-400 font-mono">BLOCKED</code> until atomic SQL updates decrement <code className="text-purple-400 font-mono">unresolvedParentCount</code> to 0.
                </p>
              </div>

              <button
                onClick={() => setDagStep((prev) => (prev % 3) + 1)}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition shrink-0"
              >
                Progress Pipeline (Phase {dagStep}/3)
              </button>
            </div>

            {/* DAG Graph Visualizer */}
            <div className="p-6 rounded-xl bg-stone-950 text-white font-mono text-xs space-y-4">
              <div className="flex items-center justify-center">
                <div className={`p-3 rounded-lg border text-center transition ${
                  dagStep >= 1 ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}>
                  Step A: Ingest Raw Telemetry (Parents: 0)<br />
                  <span className="text-[10px]">{dagStep >= 1 ? '✅ COMPLETED' : 'QUEUED'}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-stone-500">
                <span>↓ onComplete: Decrement Children</span>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className={`p-3 rounded-lg border text-center transition ${
                  dagStep >= 2 ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}>
                  Step B: Generate CSV Metrics<br />
                  <span className="text-[10px]">{dagStep >= 2 ? '✅ COMPLETED' : 'BLOCKED (Parents: 1)'}</span>
                </div>

                <div className={`p-3 rounded-lg border text-center transition ${
                  dagStep >= 2 ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}>
                  Step C: ML Anomaly Detection<br />
                  <span className="text-[10px]">{dagStep >= 2 ? '✅ COMPLETED' : 'BLOCKED (Parents: 1)'}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-stone-500">
                <span>↓ onComplete: Decrement Fan-In Child (2 → 0)</span>
              </div>

              <div className="flex items-center justify-center">
                <div className={`p-3 rounded-lg border text-center transition ${
                  dagStep === 3 ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold' : 'border-zinc-700 bg-zinc-900 text-zinc-400'
                }`}>
                  Step D: Compile Final Executive PDF & Email Execs<br />
                  <span className="text-[10px]">{dagStep === 3 ? '⚡ RUNNING FINAL AGGREGATION' : 'BLOCKED (Parents: 2)'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCENARIO 6: CONSISTENT HASH SHARDING */}
        {activeScenario === 'sharding' && (
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">
              Scenario 6: FNV-1a Consistent Hash Queue Sharding Simulator
            </h3>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              Enter any queue name to compute its 32-bit FNV-1a hash and see which dedicated worker shard fleet isolates its traffic.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={testQueueName}
                onChange={(e) => setTestQueueName(e.target.value)}
                placeholder="Enter queue name (e.g. video-transcoding)..."
                className="flex-1 px-4 py-2 rounded-xl border border-stone-300 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-xs font-mono text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className={`p-5 rounded-xl border transition ${
                shardId === 0 ? 'border-orange-500 bg-orange-500/10 shadow-lg' : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-orange-500">SHARD FLEET #0</span>
                  {shardId === 0 && <span className="px-2 py-0.5 rounded bg-orange-500 text-white text-[10px] font-bold">ACTIVE TARGET</span>}
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400">Dedicated Workers: <span className="font-mono text-stone-800 dark:text-zinc-200">Worker-Alpha, Worker-Beta</span></p>
              </div>

              <div className={`p-5 rounded-xl border transition ${
                shardId === 1 ? 'border-purple-500 bg-purple-500/10 shadow-lg' : 'border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/50 opacity-60'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-500">SHARD FLEET #1</span>
                  {shardId === 1 && <span className="px-2 py-0.5 rounded bg-purple-500 text-white text-[10px] font-bold">ACTIVE TARGET</span>}
                </div>
                <p className="text-xs text-stone-600 dark:text-zinc-400">Dedicated Workers: <span className="font-mono text-stone-800 dark:text-zinc-200">Worker-Gamma, Worker-Delta</span></p>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* ENGINEERING TRADE-OFFS MATRIX */}
      {(activeSection === 'all' || activeSection === 'tradeoffs') && (
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-bold text-stone-900 dark:text-zinc-100">Engineering Trade-Offs & Architecture Matrix</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-850/50 space-y-1.5">
            <h4 className="font-bold text-stone-900 dark:text-zinc-100">Why PostgreSQL SKIP LOCKED over Redis Redlock?</h4>
            <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
              Redlock requires multiple independent Redis master nodes and relies on clock synchronicity (vulnerable to NTP drift and network partitions). PostgreSQL <code className="text-orange-500 font-mono">SKIP LOCKED</code> provides strict ACID consistency directly inside the database with zero external lock manager overhead.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-850/50 space-y-1.5">
            <h4 className="font-bold text-stone-900 dark:text-zinc-100">Why availableAt over scheduledAt?</h4>
            <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
              <code className="text-orange-500 font-mono">availableAt</code> represents a unified timeline query: immediate jobs (<code className="font-mono">availableAt &lt;= NOW()</code>), delayed jobs, and retrying jobs with backoff all share the exact same indexed query criteria (<code className="font-mono">WHERE availableAt &lt;= NOW()</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-850/50 space-y-1.5">
            <h4 className="font-bold text-stone-900 dark:text-zinc-100">How is Split-Brain prevented in multi-replica Schedulers?</h4>
            <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
              Optimistic concurrency locking: Each scheduler attempts an atomic SQL <code className="text-orange-500 font-mono">UPDATE WHERE lockToken IS NULL OR lockExpiresAt &lt; NOW()</code>. Only the replica that receives <code className="font-mono">rows affected = 1</code> is allowed to evaluate and spawn jobs.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-850/50 space-y-1.5">
            <h4 className="font-bold text-stone-900 dark:text-zinc-100">How does the Dead Letter Queue maintain audit integrity?</h4>
            <p className="text-stone-600 dark:text-zinc-400 leading-relaxed">
              Instead of deleting or moving rows to a separate database, <code className="text-orange-500 font-mono">DeadLetterJob</code> maintains a 1:1 foreign key relation to the original <code className="font-mono">Job.id</code>, preserving all historical execution logs, attempt metrics, and stack traces.
            </p>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
