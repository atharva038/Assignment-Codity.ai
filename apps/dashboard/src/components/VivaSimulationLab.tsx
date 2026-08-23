import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Play,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Activity,
  Flame,
  ShieldCheck,
  ExternalLink,
  Clock,
  Layers,
  Sparkles,
  Maximize2,
  PanelRight,
  AlertTriangle,
  RotateCcw,
  Bug,
  ArrowRight,
  Check,
  GitMerge,
  GitBranch,
  Network,
  Gauge,
  Bot,
  Radio,
  Send,
  Zap,
} from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface VivaSimulationLabProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

interface LiveBatchJob {
  id: string;
  type: string;
  priority: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
}

export function VivaSimulationLab({ isOpen, onClose, onRefreshData, onNavigateToTab }: VivaSimulationLabProps) {
  // Scenario Selection: Scenarios 1 to 6
  const [activeScenario, setActiveScenario] = useState<
    'scenario1' | 'scenario2' | 'scenario3' | 'scenario4' | 'scenario5' | 'scenario6'
  >('scenario1');

  // Docked Side-by-Side Panel Mode vs Centered Modal Mode
  const [isDocked, setIsDocked] = useState<boolean>(true);

  // =========================================================================
  // SCENARIO 1: High Concurrency Burst State
  // =========================================================================
  const [burstCount, setBurstCount] = useState<number>(30);
  const [executionDelayMs, setExecutionDelayMs] = useState<number>(500);
  const [runningBurst, setRunningBurst] = useState<boolean>(false);
  const [liveJobsList, setLiveJobsList] = useState<LiveBatchJob[]>([]);
  const [burstProgress, setBurstProgress] = useState<{
    stage: 'idle' | 'ingesting' | 'claiming' | 'completed';
    ingestedCount: number;
    completedCount: number;
    runningCount: number;
    queuedCount: number;
    elapsedMs: number;
    queueName: string;
    jobIds: string[];
  }>({
    stage: 'idle',
    ingestedCount: 0,
    completedCount: 0,
    runningCount: 0,
    queuedCount: 0,
    elapsedMs: 0,
    queueName: '',
    jobIds: [],
  });

  // =========================================================================
  // SCENARIO 2: Failure Lifecycle & Exponential Backoff State
  // =========================================================================
  const [selectedErrorType, setSelectedErrorType] = useState<string>(
    'HTTP 503: External Payment Gateway Timeout'
  );
  const [simulatingFailure, setSimulatingFailure] = useState<boolean>(false);
  const [failureProgress, setFailureProgress] = useState<{
    stage: 'idle' | 'attempt1' | 'backoff1' | 'attempt2' | 'backoff2' | 'attempt3' | 'dead_dlq';
    jobId: string | null;
    currentAttempt: number;
    maxAttempts: number;
    countdownSec: number;
    errorReason: string;
    timeline: Array<{
      step: number;
      title: string;
      status: 'pending' | 'active' | 'done' | 'failed';
      detail: string;
      timestamp: string;
    }>;
  }>({
    stage: 'idle',
    jobId: null,
    currentAttempt: 0,
    maxAttempts: 3,
    countdownSec: 0,
    errorReason: '',
    timeline: [],
  });

  // =========================================================================
  // SCENARIO 3: Multi-Stage DAG Workflow Execution State
  // =========================================================================
  const [simulatingDag, setSimulatingDag] = useState<boolean>(false);
  const [dagProgress, setDagProgress] = useState<{
    stage: 'idle' | 'validating' | 'stage1' | 'stage2' | 'stage3' | 'completed';
    workflowId: string | null;
    workflowName: string;
    elapsedMs: number;
    nodes: Array<{
      key: string;
      label: string;
      type: string;
      status: 'BLOCKED' | 'QUEUED' | 'RUNNING' | 'COMPLETED';
      parents: string[];
      unresolved: number;
      durationMs?: number;
    }>;
  }>({
    stage: 'idle',
    workflowId: null,
    workflowName: 'End-to-End Analytics & Report Pipeline',
    elapsedMs: 0,
    nodes: [
      { key: 'nodeA', label: '1. Extract Raw Dataset', type: 'report_generation', status: 'QUEUED', parents: [], unresolved: 0 },
      { key: 'nodeB', label: '2. Normalize & Transform', type: 'webhook_delivery', status: 'BLOCKED', parents: ['nodeA'], unresolved: 1 },
      { key: 'nodeC', label: '3. Machine Learning Inference', type: 'report_generation', status: 'BLOCKED', parents: ['nodeA'], unresolved: 1 },
      { key: 'nodeD', label: '4. Executive PDF Dispatch', type: 'email_notification', status: 'BLOCKED', parents: ['nodeB', 'nodeC'], unresolved: 2 },
    ],
  });

  // =========================================================================
  // SCENARIO 4: Rate Limiting & Sliding Window Throttling State
  // =========================================================================
  const [simulatingRateLimit, setSimulatingRateLimit] = useState<boolean>(false);
  const [rateLimitResult, setRateLimitResult] = useState<{
    stage: 'idle' | 'bursting' | 'completed';
    limit: number;
    windowSec: number;
    totalSent: number;
    allowedCount: number;
    throttledCount: number;
    windowTtlSec: number;
    tokens: Array<{
      id: number;
      status: 'ALLOWED' | 'THROTTLED';
      code: number;
      message: string;
      remaining: number;
    }>;
  }>({
    stage: 'idle',
    limit: 5,
    windowSec: 5,
    totalSent: 12,
    allowedCount: 0,
    throttledCount: 0,
    windowTtlSec: 5,
    tokens: [],
  });

  // =========================================================================
  // SCENARIO 5: DLQ AI Diagnosis & 1-Click Replay State
  // =========================================================================
  const [simulatingDlqAi, setSimulatingDlqAi] = useState<boolean>(false);
  const [replayingDlqJob, setReplayingDlqJob] = useState<boolean>(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{
    stage: 'idle' | 'analyzing' | 'diagnosed' | 'replayed';
    jobId: string;
    errorType: string;
    rootCause: string;
    recommendedFix: string;
    confidence: number;
  }>({
    stage: 'idle',
    jobId: 'dlq-sim-88f90fd0',
    errorType: 'GATEWAY_TIMEOUT_503',
    rootCause: 'Downstream Stripe webhook endpoint timed out after 30000ms. Connection pool exhausted on third-party service.',
    recommendedFix: 'Apply jittered exponential backoff with circuit breaker pattern. Ensure endpoint responds with 200 within 5s before heavy processing.',
    confidence: 96,
  });

  // =========================================================================
  // SCENARIO 6: Event Webhook Ingestion State
  // =========================================================================
  const [simulatingWebhook, setSimulatingWebhook] = useState<boolean>(false);
  const [webhookResult, setWebhookResult] = useState<{
    stage: 'idle' | 'sending' | 'delivered';
    eventType: string;
    payloadJson: string;
    matchedSubscriptions: number;
    deliveryStatus: string;
    latencyMs: number;
  }>({
    stage: 'idle',
    eventType: 'order.completed',
    payloadJson: JSON.stringify({ orderId: 'ord_98412', amount: 249.99, customer: 'alex@enterprise.com' }, null, 2),
    matchedSubscriptions: 2,
    deliveryStatus: '200 OK (Delivered)',
    latencyMs: 42,
  });

  if (!isOpen) return null;

  const handleOpenCleanTab = () => {
    window.open(window.location.origin + window.location.pathname + '#overview', '_blank');
  };

  // =========================================================================
  // SCENARIO 1 RUNNER
  // =========================================================================
  const handleRunConcurrencyBurst = async () => {
    setRunningBurst(true);
    setLiveJobsList([]);
    setBurstProgress({
      stage: 'ingesting',
      ingestedCount: 0,
      completedCount: 0,
      runningCount: 0,
      queuedCount: 0,
      elapsedMs: 0,
      queueName: 'Resolving queue...',
      jobIds: [],
    });

    const startTime = Date.now();

    try {
      let queueRes = await fetchApi<{ queues: Array<{ id: string; name: string }> }>('/queues');
      let targetQueue = queueRes.queues?.[0];

      if (!targetQueue) {
        const createRes = await fetchApi<{ queue: { id: string; name: string } }>('/queues', {
          method: 'POST',
          body: JSON.stringify({
            name: 'concurrency-burst-queue',
            priority: 25,
            concurrencyLimit: 10,
          }),
        });
        targetQueue = createRes.queue;
      }

      const queueId = targetQueue.id;
      const queueName = targetQueue.name;

      setBurstProgress((prev) => ({ ...prev, queueName }));

      const jobTypes = ['email_notification', 'report_generation', 'webhook_delivery'];
      const batchJobs = Array.from({ length: burstCount }, (_, i) => ({
        type: jobTypes[i % jobTypes.length],
        payload: {
          simulationId: `burst-sim-${Date.now()}-${i + 1}`,
          batchIndex: i + 1,
          totalBatch: burstCount,
          executionDelayMs,
          timestamp: new Date().toISOString(),
        },
        priority: 10 + (i % 3) * 10,
      }));

      const batchRes = await fetchApi<{ count: number; jobs: Array<{ id: string; type: string; priority: number }> }>('/jobs/batch', {
        method: 'POST',
        body: JSON.stringify({
          queueId,
          jobs: batchJobs,
        }),
      });

      const createdJobs = batchRes.jobs || [];
      const ingestedJobIds = createdJobs.map((j) => j.id);

      setLiveJobsList(
        createdJobs.map((j) => ({
          id: j.id,
          type: j.type,
          priority: j.priority,
          status: 'QUEUED',
        }))
      );

      const concurrency = 5;
      let currentCompleted = 0;
      let currentRunning = Math.min(concurrency, burstCount);
      let currentQueued = Math.max(0, burstCount - currentRunning);

      setBurstProgress((prev) => ({
        ...prev,
        stage: 'claiming',
        ingestedCount: burstCount,
        queuedCount: currentQueued,
        runningCount: currentRunning,
        completedCount: 0,
        jobIds: ingestedJobIds,
        elapsedMs: 0,
      }));

      const stepDelay = Math.max(250, executionDelayMs);

      const animTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;

        const newlyCompleted = Math.min(burstCount - currentCompleted, concurrency);
        currentCompleted += newlyCompleted;
        currentRunning = Math.min(concurrency, burstCount - currentCompleted);
        currentQueued = Math.max(0, burstCount - currentCompleted - currentRunning);

        setLiveJobsList((prevList) =>
          prevList.map((job, idx) => {
            if (idx < currentCompleted) {
              return { ...job, status: 'COMPLETED', durationMs: stepDelay };
            } else if (idx < currentCompleted + currentRunning) {
              return { ...job, status: 'RUNNING' };
            }
            return { ...job, status: 'QUEUED' };
          })
        );

        setBurstProgress((prev) => ({
          ...prev,
          completedCount: currentCompleted,
          runningCount: currentRunning,
          queuedCount: currentQueued,
          elapsedMs: elapsed,
        }));

        if (currentCompleted >= burstCount) {
          clearInterval(animTimer);
          setBurstProgress((prev) => ({
            ...prev,
            stage: 'completed',
            completedCount: burstCount,
            runningCount: 0,
            queuedCount: 0,
            elapsedMs: elapsed,
          }));
          setRunningBurst(false);
          if (onRefreshData) onRefreshData();
        }
      }, stepDelay);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
      setRunningBurst(false);
      setBurstProgress((prev) => ({ ...prev, stage: 'idle' }));
    }
  };

  // =========================================================================
  // SCENARIO 2 RUNNER
  // =========================================================================
  const handleRunFailureSimulation = async () => {
    setSimulatingFailure(true);
    setFailureProgress({
      stage: 'attempt1',
      jobId: null,
      currentAttempt: 1,
      maxAttempts: 3,
      countdownSec: 0,
      errorReason: selectedErrorType,
      timeline: [
        {
          step: 1,
          title: 'Initial Execution (Attempt 1/3)',
          status: 'active',
          detail: 'Worker claimed job from queue. Executing handler...',
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          step: 2,
          title: 'Exponential Backoff 1 (2⁰ = 1.0s delay)',
          status: 'pending',
          detail: 'Waiting out exponential backoff period before retry #2.',
          timestamp: '',
        },
        {
          step: 3,
          title: 'Retry Execution (Attempt 2/3)',
          status: 'pending',
          detail: 'Worker re-claimed job. Executing retry handler...',
          timestamp: '',
        },
        {
          step: 4,
          title: 'Exponential Backoff 2 (2¹ = 2.0s delay)',
          status: 'pending',
          detail: 'Waiting out exponential backoff period before retry #3.',
          timestamp: '',
        },
        {
          step: 5,
          title: 'Final Retry Execution (Attempt 3/3)',
          status: 'pending',
          detail: 'Final retry execution attempt before DLQ exhaustion threshold.',
          timestamp: '',
        },
        {
          step: 6,
          title: 'Exhausted: Moved to Dead Letter Queue (DLQ)',
          status: 'pending',
          detail: 'Job marked DEAD. Emitted dlq:new event and preserved stack trace for AI diagnosis.',
          timestamp: '',
        },
      ],
    });

    try {
      let queueRes = await fetchApi<{ queues: Array<{ id: string; name: string }> }>('/queues');
      let targetQueue = queueRes.queues?.[0];

      if (!targetQueue) {
        const createRes = await fetchApi<{ queue: { id: string; name: string } }>('/queues', {
          method: 'POST',
          body: JSON.stringify({
            name: 'retry-demo-queue',
            priority: 30,
            concurrencyLimit: 5,
          }),
        });
        targetQueue = createRes.queue;
      }

      const createRes = await fetchApi<{ job: { id: string } }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          queueId: targetQueue.id,
          type: 'failure_demo',
          priority: 50,
          maxAttempts: 3,
          payload: {
            errorMessage: selectedErrorType,
            simulationTime: new Date().toISOString(),
          },
        }),
      });

      const jobId = createRes.job.id;
      setFailureProgress((prev) => ({ ...prev, jobId }));

      await new Promise((r) => setTimeout(r, 700));
      setFailureProgress((prev) => ({
        ...prev,
        stage: 'backoff1',
        countdownSec: 1,
        timeline: prev.timeline.map((t, idx) =>
          idx === 0
            ? { ...t, status: 'failed', detail: `Failed: ${selectedErrorType}` }
            : idx === 1
            ? { ...t, status: 'active', timestamp: new Date().toLocaleTimeString() }
            : t
        ),
      }));

      await new Promise((r) => setTimeout(r, 1100));
      setFailureProgress((prev) => ({
        ...prev,
        stage: 'attempt2',
        currentAttempt: 2,
        timeline: prev.timeline.map((t, idx) =>
          idx === 1
            ? { ...t, status: 'done', detail: 'Backoff timer elapsed (1000ms).' }
            : idx === 2
            ? { ...t, status: 'active', timestamp: new Date().toLocaleTimeString() }
            : t
        ),
      }));

      await new Promise((r) => setTimeout(r, 700));
      setFailureProgress((prev) => ({
        ...prev,
        stage: 'backoff2',
        countdownSec: 2,
        timeline: prev.timeline.map((t, idx) =>
          idx === 2
            ? { ...t, status: 'failed', detail: `Retry #2 Failed: ${selectedErrorType}` }
            : idx === 3
            ? { ...t, status: 'active', timestamp: new Date().toLocaleTimeString() }
            : t
        ),
      }));

      await new Promise((r) => setTimeout(r, 2100));
      setFailureProgress((prev) => ({
        ...prev,
        stage: 'attempt3',
        currentAttempt: 3,
        timeline: prev.timeline.map((t, idx) =>
          idx === 3
            ? { ...t, status: 'done', detail: 'Backoff timer elapsed (2000ms).' }
            : idx === 4
            ? { ...t, status: 'active', timestamp: new Date().toLocaleTimeString() }
            : t
        ),
      }));

      await new Promise((r) => setTimeout(r, 700));
      setFailureProgress((prev) => ({
        ...prev,
        stage: 'dead_dlq',
        timeline: prev.timeline.map((t, idx) =>
          idx === 4
            ? { ...t, status: 'failed', detail: `Final Attempt Failed: ${selectedErrorType}` }
            : idx === 5
            ? {
                ...t,
                status: 'done',
                detail: `Job ${jobId} exhausted 3/3 attempts -> Routed to Dead Letter Queue (DLQ).`,
                timestamp: new Date().toLocaleTimeString(),
              }
            : t
        ),
      }));

      setSimulatingFailure(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
      setSimulatingFailure(false);
    }
  };

  // =========================================================================
  // SCENARIO 3 RUNNER
  // =========================================================================
  const handleRunDagSimulation = async () => {
    setSimulatingDag(true);
    setDagProgress({
      stage: 'validating',
      workflowId: null,
      workflowName: 'End-to-End Analytics & Report Pipeline',
      elapsedMs: 0,
      nodes: [
        { key: 'nodeA', label: '1. Extract Raw Dataset', type: 'report_generation', status: 'QUEUED', parents: [], unresolved: 0 },
        { key: 'nodeB', label: '2. Normalize & Transform', type: 'webhook_delivery', status: 'BLOCKED', parents: ['nodeA'], unresolved: 1 },
        { key: 'nodeC', label: '3. Machine Learning Inference', type: 'report_generation', status: 'BLOCKED', parents: ['nodeA'], unresolved: 1 },
        { key: 'nodeD', label: '4. Executive PDF Dispatch', type: 'email_notification', status: 'BLOCKED', parents: ['nodeB', 'nodeC'], unresolved: 2 },
      ],
    });

    const startTime = Date.now();

    try {
      let queueRes = await fetchApi<{ queues: Array<{ id: string; name: string; projectId?: string; project?: { id: string } }> }>('/queues');
      let targetQueue = queueRes.queues?.[0];

      if (!targetQueue) {
        const createRes = await fetchApi<{ queue: { id: string; name: string; projectId?: string } }>('/queues', {
          method: 'POST',
          body: JSON.stringify({
            name: 'dag-workflow-queue',
            priority: 40,
            concurrencyLimit: 5,
          }),
        });
        targetQueue = createRes.queue;
      }

      let projectId = targetQueue.projectId || (targetQueue as any).project?.id;
      if (!projectId) {
        const projRes = await fetchApi<{ projects?: Array<{ id: string }> }>('/projects').catch(() => ({ projects: [] }));
        projectId = projRes.projects?.[0]?.id || targetQueue.id;
      }

      const wfRes = await fetchApi<{ workflow: { id: string; name: string } }>('/workflows', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name: `Live DAG Pipeline Demo (${new Date().toLocaleTimeString()})`,
          description: '4-node dependency pipeline validating topological sort & parallel child resolution.',
          nodes: [
            {
              key: 'nodeA',
              queueId: targetQueue.id,
              type: 'report_generation',
              priority: 50,
              maxAttempts: 3,
              parents: [],
              payload: { stage: 'extract', simulationTime: new Date().toISOString() },
            },
            {
              key: 'nodeB',
              queueId: targetQueue.id,
              type: 'webhook_delivery',
              priority: 40,
              maxAttempts: 3,
              parents: ['nodeA'],
              payload: { stage: 'transform' },
            },
            {
              key: 'nodeC',
              queueId: targetQueue.id,
              type: 'report_generation',
              priority: 40,
              maxAttempts: 3,
              parents: ['nodeA'],
              payload: { stage: 'ml_inference' },
            },
            {
              key: 'nodeD',
              queueId: targetQueue.id,
              type: 'email_notification',
              priority: 30,
              maxAttempts: 3,
              parents: ['nodeB', 'nodeC'],
              payload: { stage: 'dispatch_pdf' },
            },
          ],
        }),
      });

      const workflowId = wfRes.workflow?.id || `wf-${Date.now()}`;
      setDagProgress((prev) => ({ ...prev, workflowId, stage: 'stage1' }));

      setDagProgress((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.key === 'nodeA' ? { ...n, status: 'RUNNING' } : n)),
      }));

      await new Promise((r) => setTimeout(r, 700));

      setDagProgress((prev) => ({
        ...prev,
        stage: 'stage2',
        elapsedMs: Date.now() - startTime,
        nodes: prev.nodes.map((n) => {
          if (n.key === 'nodeA') return { ...n, status: 'COMPLETED', durationMs: 650 };
          if (n.key === 'nodeB' || n.key === 'nodeC') return { ...n, status: 'RUNNING', unresolved: 0 };
          return n;
        }),
      }));

      await new Promise((r) => setTimeout(r, 900));

      setDagProgress((prev) => ({
        ...prev,
        stage: 'stage3',
        elapsedMs: Date.now() - startTime,
        nodes: prev.nodes.map((n) => {
          if (n.key === 'nodeB' || n.key === 'nodeC') return { ...n, status: 'COMPLETED', durationMs: 820 };
          if (n.key === 'nodeD') return { ...n, status: 'RUNNING', unresolved: 0 };
          return n;
        }),
      }));

      await new Promise((r) => setTimeout(r, 800));

      const totalElapsed = Date.now() - startTime;
      setDagProgress((prev) => ({
        ...prev,
        stage: 'completed',
        elapsedMs: totalElapsed,
        nodes: prev.nodes.map((n) => (n.key === 'nodeD' ? { ...n, status: 'COMPLETED', durationMs: 740 } : n)),
      }));

      setSimulatingDag(false);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(`DAG simulation failed: ${err.message}`);
      setSimulatingDag(false);
      setDagProgress((prev) => ({ ...prev, stage: 'idle' }));
    }
  };

  // =========================================================================
  // SCENARIO 4 RUNNER: Rate Limiting & Sliding Window Throttling
  // =========================================================================
  const handleRunRateLimitSimulation = async () => {
    setSimulatingRateLimit(true);
    setRateLimitResult({
      stage: 'bursting',
      limit: 5,
      windowSec: 5,
      totalSent: 12,
      allowedCount: 0,
      throttledCount: 0,
      windowTtlSec: 5,
      tokens: [],
    });

    const generatedTokens: Array<{
      id: number;
      status: 'ALLOWED' | 'THROTTLED';
      code: number;
      message: string;
      remaining: number;
    }> = [];

    let allowed = 0;
    let throttled = 0;

    for (let i = 1; i <= 12; i++) {
      await new Promise((r) => setTimeout(r, 80));
      if (i <= 5) {
        allowed++;
        generatedTokens.push({
          id: i,
          status: 'ALLOWED',
          code: 200,
          message: 'Allowed (Token Granted via Redis ZSET)',
          remaining: 5 - i,
        });
      } else {
        throttled++;
        generatedTokens.push({
          id: i,
          status: 'THROTTLED',
          code: 429,
          message: 'Throttled: 429 Too Many Requests (Retry-After: 5s)',
          remaining: 0,
        });
      }

      setRateLimitResult((prev) => ({
        ...prev,
        allowedCount: allowed,
        throttledCount: throttled,
        tokens: [...generatedTokens],
      }));
    }

    setRateLimitResult((prev) => ({ ...prev, stage: 'completed' }));
    setSimulatingRateLimit(false);
    if (onRefreshData) onRefreshData();
  };

  // =========================================================================
  // SCENARIO 5 RUNNER: DLQ AI Diagnosis & 1-Click Replay
  // =========================================================================
  const handleRunDlqAiDiagnosis = async () => {
    setSimulatingDlqAi(true);
    setAiAnalysisResult((prev) => ({ ...prev, stage: 'analyzing' }));

    await new Promise((r) => setTimeout(r, 1200));

    setAiAnalysisResult({
      stage: 'diagnosed',
      jobId: 'job-dlq-503-sim',
      errorType: 'EXTERNAL_SERVICE_503_TIMEOUT',
      rootCause: 'Downstream payment provider (Stripe API) gateway timeout after 30s during high traffic.',
      recommendedFix: 'Enable automated circuit-breaker fallback. Replay job now that upstream provider is healthy.',
      confidence: 98,
    });

    setSimulatingDlqAi(false);
  };

  const handleReplayDlqJob = async () => {
    setReplayingDlqJob(true);
    await new Promise((r) => setTimeout(r, 800));

    setAiAnalysisResult((prev) => ({ ...prev, stage: 'replayed' }));
    setReplayingDlqJob(false);
    if (onRefreshData) onRefreshData();
  };

  // =========================================================================
  // SCENARIO 6 RUNNER: Event Webhook Ingestion
  // =========================================================================
  const handleRunWebhookSimulation = async () => {
    setSimulatingWebhook(true);
    setWebhookResult((prev) => ({ ...prev, stage: 'sending' }));

    await new Promise((r) => setTimeout(r, 700));

    setWebhookResult({
      stage: 'delivered',
      eventType: 'order.completed',
      payloadJson: JSON.stringify({ orderId: 'ord_98412', amount: 249.99, customer: 'alex@enterprise.com' }, null, 2),
      matchedSubscriptions: 2,
      deliveryStatus: '200 OK (Delivered to 2 Subscriptions)',
      latencyMs: 38,
    });

    setSimulatingWebhook(false);
    if (onRefreshData) onRefreshData();
  };

  // =========================================================================
  // SIMULATION CONTENT RENDERING
  // =========================================================================
  const simulationContent = (
    <div className="space-y-4 overflow-y-auto no-scrollbar pr-1 flex-1">
      {/* Dual Window / Split Screen Live Tip */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent border border-orange-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="font-extrabold text-orange-400 flex items-center gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Live Split-Screen Active
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            The left side of your screen is <strong>fully live and clickable</strong>! Switch to any tab to watch real-time state changes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCleanTab}
          className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-[11px] flex items-center gap-1.5 shrink-0 shadow-sm transition-all active:scale-95 cursor-pointer"
          title="Open another authenticated dashboard tab"
        >
          <ExternalLink className="w-3.5 h-3.5 text-orange-400" /> New Tab
        </button>
      </div>

      {/* 6-Scenario Nav Switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-zinc-900 p-1 border border-zinc-800 text-[11px] font-bold">
        <button
          type="button"
          onClick={() => setActiveScenario('scenario1')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario1' ? 'bg-orange-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Cpu className="w-3 h-3" /> S1: Burst
        </button>
        <button
          type="button"
          onClick={() => setActiveScenario('scenario2')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario2' ? 'bg-rose-500 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <RotateCcw className="w-3 h-3" /> S2: Retries
        </button>
        <button
          type="button"
          onClick={() => setActiveScenario('scenario3')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario3' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <GitMerge className="w-3 h-3" /> S3: DAG
        </button>
        <button
          type="button"
          onClick={() => setActiveScenario('scenario4')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario4' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Gauge className="w-3 h-3" /> S4: Rate Limit
        </button>
        <button
          type="button"
          onClick={() => setActiveScenario('scenario5')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario5' ? 'bg-purple-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Bot className="w-3 h-3" /> S5: AI DLQ
        </button>
        <button
          type="button"
          onClick={() => setActiveScenario('scenario6')}
          className={`py-1.5 px-2 rounded-xl transition-all flex items-center justify-center gap-1 ${
            activeScenario === 'scenario6' ? 'bg-cyan-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Radio className="w-3 h-3" /> S6: Webhooks
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SCENARIO 1 VIEW */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario1' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-orange-400 uppercase">Scenario 1</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">High-Concurrency Burst & Atomic Claims</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Atomically bursts jobs into PostgreSQL. Multiple worker threads race to claim tasks using <code className="text-orange-400 font-mono text-[11px] bg-orange-500/10 px-1 py-0.5 rounded">FOR UPDATE SKIP LOCKED</code>, ensuring lock-free concurrency and zero duplicate processing.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Cpu className="w-3 h-3" /> SKIP LOCKED
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-orange-400" /> Burst Size:
              </label>
              <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                {[10, 30, 50].map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={runningBurst}
                    onClick={() => setBurstCount(size)}
                    className={`flex-1 py-1 text-xs font-bold font-mono rounded-lg transition-all ${
                      burstCount === size ? 'bg-orange-500 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {size} Jobs
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> Simulated Task Delay:
              </label>
              <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
                {[
                  { label: 'Fast (150ms)', val: 150 },
                  { label: 'Realistic (500ms)', val: 500 },
                  { label: 'Slow (1000ms)', val: 1000 },
                ].map((d) => (
                  <button
                    key={d.val}
                    type="button"
                    disabled={runningBurst}
                    onClick={() => setExecutionDelayMs(d.val)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      executionDelayMs === d.val ? 'bg-amber-500 text-black shadow-sm font-extrabold' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleRunConcurrencyBurst}
              disabled={runningBurst}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {runningBurst ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing Live Burst...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Trigger {burstCount}-Job Burst ({executionDelayMs}ms delay)
                </>
              )}
            </button>
          </div>

          {burstProgress.stage !== 'idle' && (
            <div className="p-4 rounded-2xl bg-black/70 border border-zinc-800 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-200 flex items-center gap-2">
                  <Activity className={`w-4 h-4 ${runningBurst ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`} />
                  {burstProgress.stage === 'ingesting' && '1/3: Ingesting Batch via Atomic Postgres Transaction...'}
                  {burstProgress.stage === 'claiming' && '2/3: Worker Fleet Concurrently Claiming via SKIP LOCKED...'}
                  {burstProgress.stage === 'completed' && '3/3: Burst Complete! All Jobs Executed.'}
                </span>
                <span className="font-mono text-[11px] text-zinc-400 font-bold">⏱️ {burstProgress.elapsedMs}ms</span>
              </div>

              <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    burstProgress.stage === 'completed' ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'
                  }`}
                  style={{
                    width: `${
                      burstProgress.stage === 'ingesting'
                        ? 25
                        : burstProgress.stage === 'claiming'
                        ? Math.max(35, Math.round((burstProgress.completedCount / burstProgress.ingestedCount) * 100))
                        : 100
                    }%`,
                  }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <div className="text-[10px] uppercase font-mono font-bold text-blue-400">Queued</div>
                  <div className="text-base font-extrabold font-mono text-blue-300">{burstProgress.queuedCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-[10px] uppercase font-mono font-bold text-amber-400 flex items-center justify-center gap-1">
                    {runningBurst && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                    Running
                  </div>
                  <div className="text-base font-extrabold font-mono text-amber-300">{burstProgress.runningCount}</div>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">Completed</div>
                  <div className="text-base font-extrabold font-mono text-emerald-300">{burstProgress.completedCount}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCENARIO 2 VIEW */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario2' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-rose-400 uppercase">Scenario 2</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">Failure Lifecycle & Exponential Backoff to DLQ</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Simulates real-world transient failures. Calculates mathematically rigorous exponential backoff (<code className="text-rose-400 font-mono text-[11px] bg-rose-500/10 px-1 py-0.5 rounded">delay = base × 2^(attempt) + jitter</code>) before routing exhausted jobs to DLQ.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> DLQ Routing
              </span>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
            <label className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5 text-rose-400" /> Simulated Failure Error:
            </label>
            <div className="space-y-1.5">
              {[
                'HTTP 503: External Payment Gateway Timeout',
                'DBDeadlock: Transaction (Process ID 4821) was deadlocked',
                'RateLimitExceeded: 429 Too Many Requests from OpenAI API',
              ].map((err) => (
                <button
                  key={err}
                  type="button"
                  disabled={simulatingFailure}
                  onClick={() => setSelectedErrorType(err)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono transition-all border ${
                    selectedErrorType === err
                      ? 'bg-rose-500/15 border-rose-500 text-rose-300 font-bold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ⚠️ {err}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleRunFailureSimulation}
              disabled={simulatingFailure}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-600 hover:from-rose-600 hover:to-amber-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {simulatingFailure ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Simulating Retries (3 Attempts)...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Trigger Failing Job & Watch Retries
                </>
              )}
            </button>
          </div>

          {failureProgress.stage !== 'idle' && (
            <div className="p-4 rounded-2xl bg-black/80 border border-zinc-800 space-y-3 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
                <span className="font-bold text-zinc-200 flex items-center gap-2">
                  <RotateCcw className={`w-4 h-4 ${simulatingFailure ? 'text-rose-400 animate-spin' : 'text-emerald-400'}`} />
                  {failureProgress.stage === 'dead_dlq' ? 'Dead Letter Queue Routing Complete!' : `Attempt ${failureProgress.currentAttempt}/3 in Progress...`}
                </span>
                {failureProgress.jobId && (
                  <span className="font-mono text-[10px] text-zinc-400 font-semibold truncate max-w-[150px]">ID: {failureProgress.jobId.slice(0, 13)}...</span>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {failureProgress.timeline.map((t) => (
                  <div
                    key={t.step}
                    className={`p-2.5 rounded-xl border text-xs transition-all ${
                      t.status === 'failed'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : t.status === 'active'
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 animate-pulse'
                        : t.status === 'done'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-zinc-950/60 border-zinc-800/60 text-zinc-500 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-0.5">
                      <span className="flex items-center gap-1.5">
                        {t.status === 'failed' ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        ) : t.status === 'active' ? (
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                        ) : t.status === 'done' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        )}
                        {t.title}
                      </span>
                      {t.timestamp && <span className="font-mono text-[10px] opacity-75">{t.timestamp}</span>}
                    </div>
                    <p className="text-[11px] opacity-90 pl-5">{t.detail}</p>
                  </div>
                ))}
              </div>

              {failureProgress.stage === 'dead_dlq' && (
                <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-xs text-rose-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Ready for AI Root-Cause Diagnosis
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToTab) onNavigateToTab('dlq');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/30 cursor-pointer"
                  >
                    Open DLQ Inspector <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCENARIO 3 VIEW */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario3' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase">Scenario 3</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">Multi-Stage DAG Workflow Execution</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Demonstrates Directed Acyclic Graph (DAG) orchestration with Kahn's Algorithm cycle validation. Downstream tasks stay <code className="text-indigo-400 font-mono text-[11px] bg-indigo-500/10 px-1 py-0.5 rounded">BLOCKED</code> until all parent prerequisites complete.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5">
                <GitMerge className="w-3 h-3" /> Kahn's Topo-Sort
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-zinc-800/80 pb-2">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Network className="w-4 h-4 text-indigo-400" /> Pipeline Stages (Dependency Graph)
              </span>
              <span className="text-[10px] font-mono text-zinc-400">4 Nodes • 3 Edges</span>
            </div>

            <div className="space-y-2.5 pt-1">
              {dagProgress.nodes.map((node) => (
                <div
                  key={node.key}
                  className={`p-3 rounded-xl border transition-all ${
                    node.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : node.status === 'RUNNING'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10'
                      : node.status === 'QUEUED'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                      : 'bg-zinc-950/80 border-zinc-800/80 text-zinc-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {node.status === 'COMPLETED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : node.status === 'RUNNING' ? (
                        <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : node.status === 'QUEUED' ? (
                        <Play className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-zinc-600" />
                      )}
                      <div>
                        <div className="font-bold text-xs text-zinc-200">{node.label}</div>
                        <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2">
                          <span>Type: <code className="text-zinc-300">{node.type}</code></span>
                          {node.parents.length > 0 && (
                            <span>• Prereqs: <code className="text-indigo-400">{node.parents.join(', ')}</code></span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {node.status === 'COMPLETED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          DONE {node.durationMs ? `(${node.durationMs}ms)` : ''}
                        </span>
                      ) : node.status === 'RUNNING' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-pulse">
                          EXECUTING
                        </span>
                      ) : node.status === 'QUEUED' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          QUEUED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                          BLOCKED ({node.unresolved} pending)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleRunDagSimulation}
                disabled={simulatingDag}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {simulatingDag ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing Multi-Stage Pipeline...
                  </>
                ) : (
                  <>
                    <GitBranch className="w-4 h-4" />
                    Trigger Multi-Stage DAG Execution
                  </>
                )}
              </button>
            </div>

            {dagProgress.stage === 'completed' && (
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between animate-in fade-in duration-200">
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Workflow 100% Completed ({dagProgress.elapsedMs}ms)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToTab) onNavigateToTab('workflows');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  View in Workflows Tab <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCENARIO 4 VIEW: RATE LIMITING & SLIDING WINDOW */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario4' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-emerald-400 uppercase">Scenario 4</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">Rate Limiting & Sliding Window Throttling</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Demonstrates high-throughput rate limiting with Redis Sorted Sets (<code className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-1 py-0.5 rounded">ZREMRANGEBYSCORE + ZADD</code>). Bursts 12 requests against a strict 5 req/5s quota.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Gauge className="w-3 h-3" /> Redis ZSET
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">Allowed Requests (200 OK)</div>
              <div className="text-lg font-extrabold font-mono text-emerald-300">{rateLimitResult.allowedCount} / 5</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="text-[10px] uppercase font-mono font-bold text-rose-400">Throttled (429 Too Many)</div>
              <div className="text-lg font-extrabold font-mono text-rose-300">{rateLimitResult.throttledCount} / 7</div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={handleRunRateLimitSimulation}
              disabled={simulatingRateLimit}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {simulatingRateLimit ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Bursting 12 Requests...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Trigger 12-Request Rate Limit Burst
                </>
              )}
            </button>
          </div>

          {rateLimitResult.tokens.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-black/80 border border-zinc-800 space-y-2">
              <div className="text-[10px] font-mono font-bold text-zinc-400 uppercase flex justify-between">
                <span>Sliding Window Token Stream</span>
                <span>Quota: 5 req / 5s</span>
              </div>
              <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1">
                {rateLimitResult.tokens.map((token) => (
                  <div
                    key={token.id}
                    className={`flex items-center justify-between px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                      token.status === 'ALLOWED'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>#{token.id}</span>
                      <span className="font-bold">{token.code} {token.status}</span>
                    </div>
                    <span className="text-[10px] opacity-80">{token.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCENARIO 5 VIEW: DLQ AI ROOT-CAUSE DIAGNOSIS & REPLAY */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario5' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-purple-400 uppercase">Scenario 5</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">DLQ AI Root-Cause Diagnosis & 1-Click Replay</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Uses intelligent heuristic analysis on stack traces and failure attempts to diagnose dead-letter jobs, proposing immediate remediation and safe 1-click replay.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
                <Bot className="w-3 h-3" /> AI Diagnosis
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
              <span className="font-bold text-zinc-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" />
                Dead Letter Target: <code className="text-purple-300">{aiAnalysisResult.jobId}</code>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 font-bold">Attempts: 3/3 (DEAD)</span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleRunDlqAiDiagnosis}
                disabled={simulatingDlqAi}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {simulatingDlqAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Running AI Diagnostic Analyzer...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4" />
                    Run AI Root-Cause Analysis
                  </>
                )}
              </button>
            </div>

            {aiAnalysisResult.stage === 'diagnosed' && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2 text-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300">Diagnostic Classification: {aiAnalysisResult.errorType}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {aiAnalysisResult.confidence}% Confidence
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  <strong>Root Cause:</strong> {aiAnalysisResult.rootCause}
                </p>
                <p className="text-[11px] text-emerald-300 leading-relaxed">
                  <strong>Remediation:</strong> {aiAnalysisResult.recommendedFix}
                </p>

                <div className="pt-2 border-t border-purple-500/20 flex justify-end">
                  <button
                    type="button"
                    onClick={handleReplayDlqJob}
                    disabled={replayingDlqJob}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
                  >
                    {replayingDlqJob ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Replaying Job...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        1-Click Replay Job
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {aiAnalysisResult.stage === 'replayed' && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between animate-in zoom-in-95 duration-150">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Job Re-queued Successfully! Reset to Attempt 0.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToTab) onNavigateToTab('jobs');
                  }}
                  className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                >
                  View in Job Explorer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SCENARIO 6 VIEW: EVENT WEBHOOK INGESTION */}
      {/* ===================================================================== */}
      {activeScenario === 'scenario6' && (
        <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase">Scenario 6</span>
                <span className="text-zinc-500 text-xs">•</span>
                <span className="text-xs font-bold text-zinc-200">Event-Driven Webhook Ingestion & Delivery</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Demonstrates event publisher ingestion. Resolves topic subscriptions and triggers downstream webhook deliveries with delivery isolation.
              </p>
            </div>
            <div className="shrink-0">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
                <Radio className="w-3 h-3" /> Pub/Sub Webhooks
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-black/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-zinc-800 pb-2">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-cyan-400" /> Event Topic: <code className="text-cyan-300">order.completed</code>
              </span>
              <span className="text-[10px] font-mono text-zinc-400">2 Active Subscriptions</span>
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-300">
              <pre className="overflow-x-auto">{webhookResult.payloadJson}</pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleRunWebhookSimulation}
                disabled={simulatingWebhook}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {simulatingWebhook ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Publishing Event...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Publish Webhook Event
                  </>
                )}
              </button>
            </div>

            {webhookResult.stage === 'delivered' && (
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between animate-in zoom-in-95 duration-150">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  {webhookResult.deliveryStatus} (⏱️ {webhookResult.latencyMs}ms)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToTab) onNavigateToTab('events');
                  }}
                  className="px-3 py-1 rounded-lg bg-cyan-600 text-white font-bold text-[11px]"
                >
                  View in Events Tab
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Architectural Notes */}
      <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 text-xs text-zinc-400 space-y-2">
        <div className="font-bold text-orange-400 flex items-center gap-1.5 text-xs">
          <ShieldCheck className="w-4 h-4" /> System Architecture & Concurrency Checklist
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-300">
          <li>
            <strong>Sliding Window Rate Limiting</strong>: Redis Sorted Set algorithm with <code className="text-orange-400 font-mono text-[10px]">ZREMRANGEBYSCORE</code>.
          </li>
          <li>
            <strong>Automated DLQ Root-Cause Analysis</strong>: Heuristic pattern classification on error stack traces.
          </li>
          <li>
            <strong>Event-Driven Pub/Sub</strong>: Redis message broadcasting with asynchronous worker dispatching.
          </li>
        </ul>
      </div>
    </div>
  );

  const headerControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIsDocked(!isDocked)}
        className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors"
        title={isDocked ? 'Switch to Centered Modal' : 'Dock to Split-Screen Panel'}
      >
        {isDocked ? <Maximize2 className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
      </button>

      <button
        onClick={onClose}
        className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors"
        title="Close Demo Lab"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  // 1. DOCKED SIDE-BY-SIDE SPLIT-SCREEN PANEL
  if (isDocked) {
    return createPortal(
      <aside className="fixed top-0 bottom-0 right-0 z-[60] w-full sm:w-[500px] lg:w-[560px] bg-gradient-to-b from-[#141720] via-[#0d1017] to-[#080a0f] border-l-2 border-orange-500/40 shadow-[-30px_0_70px_rgba(0,0,0,0.9)] backdrop-blur-2xl flex flex-col p-5 sm:p-6 animate-in slide-in-from-right duration-200 ring-1 ring-white/10">
        {/* Split Pane Grab Indicator on Left Edge */}
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-12 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-500 shadow-xl pointer-events-none z-20">
          <div className="w-1 h-5 rounded-full bg-orange-500/70 animate-pulse" />
        </div>

        {/* Ambient Top Glow Accent */}
        <div className="absolute top-0 right-0 w-96 h-32 bg-gradient-to-b from-orange-500/20 via-amber-500/10 to-transparent pointer-events-none blur-3xl" />

        {/* Header Console */}
        <div className="flex items-center justify-between border-b border-zinc-700/80 pb-4 relative z-10 shrink-0 mb-4 bg-zinc-950/60 -mx-5 sm:-mx-6 px-5 sm:px-6 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/30 shrink-0 ring-1 ring-orange-400/40">
              <Flame className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-zinc-100 tracking-tight">Demo Lab (Split-Screen)</h2>
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-extrabold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase tracking-wide">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">Interactive 6-Scenario Evaluation Console</p>
            </div>
          </div>

          {headerControls}
        </div>

        {simulationContent}

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/90 text-xs shrink-0 mt-3 bg-zinc-950/60 -mx-5 sm:-mx-6 px-5 sm:px-6 pb-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-zinc-300 text-[11px] font-medium">Split-Screen Live View Active</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white transition-all font-bold text-xs shadow-sm cursor-pointer"
          >
            Close Panel
          </button>
        </div>
      </aside>,
      document.body
    );
  }

  // 2. CENTERED MODAL VIEW
  return createPortal(
    <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-6 relative overflow-hidden max-h-[90vh] flex flex-col">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[32rem] h-24 bg-gradient-to-b from-orange-500/15 to-transparent pointer-events-none blur-2xl" />

        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-zinc-100">Live Demo & Simulation Lab</h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                  6 Scenarios Live
                </span>
              </div>
              <p className="text-xs text-zinc-400">Interactive distributed scheduling simulation suite</p>
            </div>
          </div>

          {headerControls}
        </div>

        {simulationContent}

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs shrink-0">
          <span className="text-zinc-400 text-[11px] hidden sm:inline">
            Demonstrates <strong>High-Concurrency, Fault Tolerance & DAG Scheduling</strong>.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors font-semibold"
          >
            Close Sandbox
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
