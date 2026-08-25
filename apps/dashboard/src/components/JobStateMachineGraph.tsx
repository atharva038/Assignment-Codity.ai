import React, { useState } from 'react';
import {
  GitCommit,
  ArrowRight,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  Zap,
  Shield,
  Code2,
  Sparkles,
  Info,
  Maximize2,
  ChevronRight,
  Cpu,
  Database,
  Radio,
  FileText,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';

export type JobStateKey =
  | 'QUEUED'
  | 'CLAIMED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRYING'
  | 'DEAD';

interface StateMetadata {
  key: JobStateKey;
  label: string;
  badge: string;
  color: string;
  bgDark: string;
  bgLight: string;
  borderDark: string;
  borderLight: string;
  textDark: string;
  textLight: string;
  description: string;
  allowedTransitions: JobStateKey[];
  dbQuery: string;
  eventBroadcast: string;
  invariants: string[];
}

export const JobStateMachineGraph: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeState, setActiveState] = useState<JobStateKey>('QUEUED');
  const [activeSimulationPath, setActiveSimulationPath] = useState<'happy_path' | 'retry_flow' | 'dlq_flow'>('happy_path');
  const [simStep, setSimStep] = useState<number>(0);

  const stateDetails: Record<JobStateKey, StateMetadata> = {
    QUEUED: {
      key: 'QUEUED',
      label: 'QUEUED',
      badge: 'Initial / Ready',
      color: 'from-blue-500 to-cyan-600',
      bgDark: '#0c1929',
      bgLight: '#eff6ff',
      borderDark: '#1e3a8a',
      borderLight: '#bfdbfe',
      textDark: '#93c5fd',
      textLight: '#1d4ed8',
      description: 'Job is persisted in PostgreSQL and waiting for available worker capacity. Eligible for claiming when NOW() >= availableAt and unresolvedParentCount === 0.',
      allowedTransitions: ['CLAIMED'],
      dbQuery: `SELECT id FROM jobs 
WHERE queueId = $1 AND status = 'QUEUED' 
  AND availableAt <= NOW() 
  AND unresolvedParentCount = 0
ORDER BY priority DESC, availableAt ASC 
LIMIT 5 FOR UPDATE SKIP LOCKED;`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_QUEUED', jobId, queueId }));`,
      invariants: [
        'Atomic index: (queueId, status, priority DESC, availableAt ASC)',
        'Zero worker block time: SKIP LOCKED bypasses concurrent worker locks instantly',
        'Paused queues automatically filter out of candidate claim scans',
      ],
    },
    CLAIMED: {
      key: 'CLAIMED',
      label: 'CLAIMED',
      badge: 'Lease Acquired',
      color: 'from-amber-500 to-yellow-600',
      bgDark: '#261b0c',
      bgLight: '#fefce8',
      borderDark: '#78350f',
      borderLight: '#fef08a',
      textDark: '#fde047',
      textLight: '#a16207',
      description: 'Worker process claimed the job row in an atomic ACID transaction. Time-bound lease set via lockedUntil.',
      allowedTransitions: ['RUNNING', 'QUEUED'],
      dbQuery: `UPDATE jobs 
SET status = 'CLAIMED', 
    lastWorkerId = $1, 
    lockedUntil = NOW() + INTERVAL '30 seconds',
    attempts = attempts + 1
WHERE id IN ($jobIds);`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_CLAIMED', jobId, workerId }));`,
      invariants: [
        'Lease expiration (lockedUntil) protects against worker process crash (kill -9)',
        'Reaper daemon reclaims orphaned CLAIMED jobs if worker crashes before handler start',
      ],
    },
    RUNNING: {
      key: 'RUNNING',
      label: 'RUNNING',
      badge: 'Executing Handler',
      color: 'from-orange-500 to-amber-600',
      bgDark: '#29180c',
      bgLight: '#fff7ed',
      borderDark: '#7c2d12',
      borderLight: '#fed7aa',
      textDark: '#fdba74',
      textLight: '#c2410c',
      description: 'Worker child process or async handler is actively executing the job payload logic while streaming real-time logs.',
      allowedTransitions: ['COMPLETED', 'FAILED'],
      dbQuery: `INSERT INTO job_executions (id, jobId, workerId, attemptNumber, status, startedAt)
VALUES ($uuid, $jobId, $workerId, $attempts, 'RUNNING', NOW());`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_RUNNING', jobId, attempt: 1 }));`,
      invariants: [
        'Heartbeat telemetry emitted every 5s to keep lease valid for long-running jobs',
        'Worker concurrency slot decremented when execution concludes',
      ],
    },
    COMPLETED: {
      key: 'COMPLETED',
      label: 'COMPLETED',
      badge: 'Terminal Success',
      color: 'from-emerald-500 to-teal-600',
      bgDark: '#0b241b',
      bgLight: '#f0fdf4',
      borderDark: '#064e3b',
      borderLight: '#bbf7d0',
      textDark: '#6ee7b7',
      textLight: '#15803d',
      description: 'Job handler successfully returned. Execution record marked COMPLETED with duration, triggering downstream DAG children.',
      allowedTransitions: [],
      dbQuery: `UPDATE jobs SET status = 'COMPLETED', lockedUntil = NULL WHERE id = $jobId;
-- Decrement downstream DAG child dependencies
UPDATE jobs SET unresolvedParentCount = unresolvedParentCount - 1 
WHERE id IN (SELECT childJobId FROM job_dependencies WHERE parentJobId = $jobId);`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_COMPLETED', jobId, durationMs: 340 }));`,
      invariants: [
        'Downstream child jobs automatically unlocked from BLOCKED to QUEUED when parentCount hits 0',
        'Execution output result serialized into JSONB in job_executions table',
      ],
    },
    FAILED: {
      key: 'FAILED',
      label: 'FAILED',
      badge: 'Execution Error',
      color: 'from-rose-500 to-red-600',
      bgDark: '#2a0e14',
      bgLight: '#fef2f2',
      borderDark: '#881337',
      borderLight: '#fecaca',
      textDark: '#fda4af',
      textLight: '#b91c1c',
      description: 'Job handler threw an unhandled exception, network timeout, or non-200 HTTP response code.',
      allowedTransitions: ['RETRYING', 'DEAD'],
      dbQuery: `UPDATE job_executions 
SET status = 'FAILED', errorReason = $errorMsg, completedAt = NOW(), durationMs = $duration 
WHERE id = $executionId;`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_FAILED', jobId, error: $errorMsg }));`,
      invariants: [
        'Captures complete error stack trace in execution record for debugging',
        'Evaluates retryPolicy: if attempts < maxAttempts -> RETRYING; else -> DEAD',
      ],
    },
    RETRYING: {
      key: 'RETRYING',
      label: 'RETRYING',
      badge: 'Backoff Delay',
      color: 'from-purple-500 to-indigo-600',
      bgDark: '#1f132e',
      bgLight: '#faf5ff',
      borderDark: '#581c87',
      borderLight: '#e9d5ff',
      textDark: '#d8b4fe',
      textLight: '#7e22ce',
      description: 'Job scheduled for future re-execution after an exponential backoff delay with decorrelated jitter to prevent thundering herd.',
      allowedTransitions: ['QUEUED'],
      dbQuery: `UPDATE jobs 
SET status = 'RETRYING', 
    availableAt = NOW() + ($delayMs * INTERVAL '1 millisecond'),
    lockedUntil = NULL
WHERE id = $jobId;`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_RETRYING', jobId, delayMs: 4000 }));`,
      invariants: [
        'Formula: delay = min(maxDelay, base * 2^(attempt-1)) ± 10% Jitter',
        'Delayed Promoter background loop sets status back to QUEUED once availableAt <= NOW()',
      ],
    },
    DEAD: {
      key: 'DEAD',
      label: 'DEAD',
      badge: 'DLQ Quarantine',
      color: 'from-stone-600 to-zinc-700',
      bgDark: '#18181b',
      bgLight: '#f4f4f5',
      borderDark: '#3f3f46',
      borderLight: '#d4d4d8',
      textDark: '#d4d4d8',
      textLight: '#3f3f46',
      description: 'Permanent failure threshold exceeded (attempts >= maxAttempts). Job quarantined in Dead Letter Queue preserving 1:1 foreign key audit trail.',
      allowedTransitions: ['QUEUED'],
      dbQuery: `UPDATE jobs SET status = 'DEAD', lockedUntil = NULL WHERE id = $jobId;
INSERT INTO dead_letter_jobs (id, originalJobId, queueId, attempts, finalErrorReason)
VALUES ($uuid, $jobId, $queueId, $attempts, $lastError);`,
      eventBroadcast: `redis.publish('job-events', JSON.stringify({ event: 'JOB_DEAD', jobId, queueId }));`,
      invariants: [
        'Original job row preserved forever for full audit integrity (never cloned or deleted)',
        'One-click replay resets attempts to 0, status to QUEUED, and resolutionStatus to RETRIED',
      ],
    },
  };

  const currentState = stateDetails[activeState];

  // SVG Graph Node Positions (viewBox 0 0 1000 480)
  const nodeCoords: Record<JobStateKey, { x: number; y: number; width: number; height: number }> = {
    QUEUED: { x: 50, y: 190, width: 140, height: 75 },
    CLAIMED: { x: 260, y: 190, width: 140, height: 75 },
    RUNNING: { x: 470, y: 190, width: 140, height: 75 },
    COMPLETED: { x: 740, y: 70, width: 150, height: 80 },
    FAILED: { x: 740, y: 290, width: 150, height: 80 },
    RETRYING: { x: 470, y: 390, width: 140, height: 75 },
    DEAD: { x: 740, y: 410, width: 150, height: 75 },
  };

  // Stepper Scenarios
  const runSimulationStep = (path: 'happy_path' | 'retry_flow' | 'dlq_flow') => {
    setActiveSimulationPath(path);
    if (path === 'happy_path') {
      const steps: JobStateKey[] = ['QUEUED', 'CLAIMED', 'RUNNING', 'COMPLETED'];
      const nextIdx = (simStep + 1) % steps.length;
      setSimStep(nextIdx);
      setActiveState(steps[nextIdx]);
    } else if (path === 'retry_flow') {
      const steps: JobStateKey[] = ['QUEUED', 'CLAIMED', 'RUNNING', 'FAILED', 'RETRYING', 'QUEUED'];
      const nextIdx = (simStep + 1) % steps.length;
      setSimStep(nextIdx);
      setActiveState(steps[nextIdx]);
    } else {
      const steps: JobStateKey[] = ['QUEUED', 'CLAIMED', 'RUNNING', 'FAILED', 'DEAD', 'QUEUED'];
      const nextIdx = (simStep + 1) % steps.length;
      setSimStep(nextIdx);
      setActiveState(steps[nextIdx]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Scenario Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <GitCommit className="w-3.5 h-3.5" />
            Deterministic State Machine • Strict Transition Guardrails
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-stone-950 dark:text-zinc-100 tracking-tight">
            Interactive Job Lifecycle State Machine
          </h2>
          <p className="text-xs text-stone-600 dark:text-zinc-400 max-w-2xl mt-1 leading-relaxed">
            Click on any state node to inspect its database locking queries, allowed transition vectors, and crash recovery rules.
          </p>
        </div>

        {/* Live Simulation Trigger Buttons */}
        <div className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border shadow-sm ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-stone-200 border-stone-300'
        }`}>
          <button
            onClick={() => runSimulationStep('happy_path')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSimulationPath === 'happy_path'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300'
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Success Run (Step {activeSimulationPath === 'happy_path' ? simStep + 1 : 1}/4)
          </button>

          <button
            onClick={() => runSimulationStep('retry_flow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSimulationPath === 'retry_flow'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" /> Retry Loop (Step {activeSimulationPath === 'retry_flow' ? simStep + 1 : 1}/6)
          </button>

          <button
            onClick={() => runSimulationStep('dlq_flow')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeSimulationPath === 'dlq_flow'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : isDark ? 'text-zinc-300 hover:text-white hover:bg-zinc-800' : 'text-stone-700 hover:text-stone-950 hover:bg-stone-300'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5" /> DLQ Isolation (Step {activeSimulationPath === 'dlq_flow' ? simStep + 1 : 1}/6)
          </button>
        </div>
      </div>

      {/* SVG STATE MACHINE GRAPH CANVAS */}
      <div className={`rounded-3xl border shadow-xl overflow-hidden ${
        isDark ? 'bg-[#08090d] border-zinc-800' : 'bg-[#FAF8F5] border-[#D9D3C7]'
      }`}>
        <div className={`px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs font-mono font-bold ${
          isDark ? 'bg-zinc-900/50 border-zinc-800 text-zinc-400' : 'bg-[#EDE8DC] border-[#D9D3C7] text-stone-700'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            7 Authoritative States • Zero Ambiguity State Machine
          </div>
          <div>Active State: <span className="text-orange-600 dark:text-orange-400 font-extrabold">{activeState}</span></div>
        </div>

        <div className="p-4 sm:p-6 overflow-x-auto select-none">
          <svg viewBox="0 0 960 500" className="w-full min-w-[850px] h-auto font-sans">
            {/* Defs: Filters, Gradients, and Markers */}
            <defs>
              <filter id="state-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="state-particle-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>

              <linearGradient id="grad-q-c" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>

              <linearGradient id="grad-c-r" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>

              <linearGradient id="grad-r-comp" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              <linearGradient id="grad-r-fail" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>

              <linearGradient id="grad-f-retry" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>

              <linearGradient id="grad-retry-q" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>

              <linearGradient id="grad-dead-q" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>

              {/* Background Grid */}
              <pattern id="state-grid" width="25" height="25" patternUnits="userSpaceOnUse">
                <circle cx="12.5" cy="12.5" r="1.2" fill={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)'} />
              </pattern>
            </defs>

            <rect width="960" height="500" fill="url(#state-grid)" />

            {/* SMOOTH BEZIER TRANSITION CONNECTORS */}
            {/* QUEUED -> CLAIMED */}
            <path d="M 190 227 L 260 227" stroke="url(#grad-q-c)" strokeWidth="2.5" strokeDasharray="5 3" className="animate-dash" />

            {/* CLAIMED -> RUNNING */}
            <path d="M 400 227 L 470 227" stroke="url(#grad-c-r)" strokeWidth="2.5" strokeDasharray="5 3" className="animate-dash" />

            {/* RUNNING -> COMPLETED (Smooth S-curve) */}
            <path d="M 610 210 C 675 210, 675 110, 740 110" stroke="url(#grad-r-comp)" strokeWidth="3" strokeDasharray="6 3" className="animate-dash" fill="none" />

            {/* RUNNING -> FAILED (Smooth S-curve) */}
            <path d="M 610 245 C 675 245, 675 330, 740 330" stroke="url(#grad-r-fail)" strokeWidth="3" strokeDasharray="6 3" className="animate-dash" fill="none" />

            {/* FAILED -> RETRYING (Smooth S-curve) */}
            <path d="M 740 350 C 675 350, 675 425, 610 425" stroke="url(#grad-f-retry)" strokeWidth="2.5" strokeDasharray="5 3" className="animate-dash" fill="none" />

            {/* RETRYING -> QUEUED (Backoff Loop) */}
            <path d="M 470 425 C 220 425, 120 380, 120 265" stroke="url(#grad-retry-q)" strokeWidth="2.5" strokeDasharray="6 3" className="animate-dash" fill="none" />

            {/* FAILED -> DEAD (Max Attempts Exceeded) */}
            <path d="M 815 370 L 815 410" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 3" />

            {/* DEAD -> QUEUED (1-Click Replay) */}
            <path d="M 740 450 C 250 490, 60 380, 60 265" stroke="url(#grad-dead-q)" strokeWidth="2.2" strokeDasharray="6 4" fill="none" />

            {/* ANIMATED PARTICLES ALONG STATE PATHS */}
            <circle r="4" fill="#60a5fa" filter="url(#state-particle-glow)">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M 190 227 L 260 227" />
            </circle>
            <circle r="4" fill="#fbbf24" filter="url(#state-particle-glow)">
              <animateMotion dur="2.2s" repeatCount="indefinite" path="M 400 227 L 470 227" />
            </circle>
            <circle r="4.5" fill="#34d399" filter="url(#state-particle-glow)">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 610 210 C 675 210, 675 110, 740 110" />
            </circle>
            <circle r="4.5" fill="#fb7185" filter="url(#state-particle-glow)">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M 610 245 C 675 245, 675 330, 740 330" />
            </circle>
            <circle r="4" fill="#c084fc" filter="url(#state-particle-glow)">
              <animateMotion dur="3.0s" repeatCount="indefinite" path="M 740 350 C 675 350, 675 425, 610 425" />
            </circle>
            <circle r="4" fill="#a78bfa" filter="url(#state-particle-glow)">
              <animateMotion dur="3.5s" repeatCount="indefinite" path="M 470 425 C 220 425, 120 380, 120 265" />
            </circle>

            {/* Labels on Arrows */}
            <rect x="200" y="215" width="50" height="18" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#3b82f6" strokeWidth="0.8" />
            <text x="225" y="227" fill={isDark ? '#93c5fd' : '#1d4ed8'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">CLAIM</text>

            <rect x="410" y="215" width="50" height="18" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#f59e0b" strokeWidth="0.8" />
            <text x="435" y="227" fill={isDark ? '#fde047' : '#b45309'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">EXEC</text>

            <rect x="635" y="145" width="70" height="18" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#10b981" strokeWidth="0.8" />
            <text x="670" y="157" fill={isDark ? '#6ee7b7' : '#047857'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">200 OK SUCCESS</text>

            <rect x="635" y="285" width="70" height="18" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#f43f5e" strokeWidth="0.8" />
            <text x="670" y="297" fill={isDark ? '#fda4af' : '#be123c'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ERROR / TIMEOUT</text>

            <rect x="230" y="415" width="130" height="18" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#8b5cf6" strokeWidth="0.8" />
            <text x="295" y="427" fill={isDark ? '#d8b4fe' : '#7e22ce'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">EXP BACKOFF + JITTER</text>

            <rect x="350" y="442" width="100" height="16" rx="4" fill={isDark ? '#18181b' : '#FFFFFF'} stroke="#059669" strokeWidth="0.8" />
            <text x="400" y="453" fill={isDark ? '#34d399' : '#059669'} fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">1-CLICK DLQ REPLAY</text>

            {/* STATE NODES */}
            {Object.keys(stateDetails).map((key) => {
              const state = stateDetails[key as JobStateKey];
              const pos = nodeCoords[key as JobStateKey];
              const isSelected = activeState === key;

              return (
                <g
                  key={key}
                  onClick={() => setActiveState(key as JobStateKey)}
                  className="cursor-pointer transition-all duration-200"
                >
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height={pos.height}
                    rx="14"
                    fill={isDark ? (isSelected ? state.bgDark : '#12131a') : (isSelected ? state.bgLight : '#FFFFFF')}
                    stroke={isSelected ? (isDark ? state.textDark : state.textLight) : (isDark ? '#27272a' : '#D9D3C7')}
                    strokeWidth={isSelected ? '3' : '1.5'}
                    filter={isSelected ? 'url(#state-glow)' : undefined}
                  />

                  {/* Header strip */}
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={pos.width}
                    height="24"
                    rx="14"
                    fill={isDark ? state.bgDark : state.bgLight}
                  />
                  <rect
                    x={pos.x}
                    y={pos.y + 14}
                    width={pos.width}
                    height="10"
                    fill={isDark ? state.bgDark : state.bgLight}
                  />

                  <text
                    x={pos.x + 12}
                    y={pos.y + 16}
                    fill={isDark ? state.textDark : state.textLight}
                    fontSize="10.5"
                    fontWeight="black"
                    fontFamily="monospace"
                  >
                    ● {state.label}
                  </text>

                  <text
                    x={pos.x + 12}
                    y={pos.y + 42}
                    fill={isDark ? '#e4e4e7' : '#18181b'}
                    fontSize="9.5"
                    fontFamily="sans-serif"
                    fontWeight="bold"
                  >
                    {state.badge}
                  </text>

                  <text
                    x={pos.x + 12}
                    y={pos.y + 58}
                    fill={isDark ? '#a1a1aa' : '#71717a'}
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {state.allowedTransitions.length > 0 ? `→ ${state.allowedTransitions.join(', ')}` : 'Terminal State'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* STATE INSPECTOR DETAIL CARD */}
      <div className={`rounded-3xl border shadow-xl p-6 sm:p-8 space-y-6 ${
        isDark ? 'bg-[#0f1016] border-zinc-800' : 'bg-white border-stone-200'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-stone-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm border shadow-sm ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-stone-100 border-stone-300 text-stone-900'
            }`}>
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-stone-950 dark:text-zinc-100">{currentState.label} State Inspector</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {currentState.badge}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5">{currentState.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-stone-500 dark:text-zinc-400">Allowed Transitions:</span>
            {currentState.allowedTransitions.length === 0 ? (
              <span className="px-2 py-1 rounded bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-mono text-xs font-bold">None (Terminal)</span>
            ) : (
              currentState.allowedTransitions.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveState(t)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-mono text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <span>{t}</span> <ArrowRight className="w-3 h-3" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* 2-Column Code & Invariants Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Database SQL & Redis Broadcast */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 mb-2">
                <Database className="w-4 h-4 text-emerald-500" />
                <span>PostgreSQL State Mutation & Row Locking SQL</span>
              </div>
              <pre className="p-4 rounded-2xl bg-stone-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800 shadow-inner">
                <code>{currentState.dbQuery}</code>
              </pre>
            </div>

            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 mb-2">
                <Radio className="w-4 h-4 text-rose-500" />
                <span>Redis Pub/Sub Real-Time Telemetry Event</span>
              </div>
              <pre className="p-3.5 rounded-2xl bg-stone-950 text-rose-400 font-mono text-xs overflow-x-auto leading-relaxed border border-stone-800 shadow-inner">
                <code>{currentState.eventBroadcast}</code>
              </pre>
            </div>
          </div>

          {/* Right Column: Architectural Invariants */}
          <div className="space-y-4">
            <div className={`p-5 rounded-2xl border space-y-3 ${
              isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-stone-50 border-stone-200'
            }`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4" /> State Invariants & Failure Guarantees
              </h4>
              <ul className="space-y-2">
                {currentState.invariants.map((inv, idx) => (
                  <li key={idx} className="text-xs flex items-start gap-2.5 text-stone-800 dark:text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{inv}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
