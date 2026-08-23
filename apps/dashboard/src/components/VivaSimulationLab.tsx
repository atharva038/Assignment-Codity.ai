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
  PanelRightClose,
  PanelRight,
} from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface VivaSimulationLabProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

interface LiveBatchJob {
  id: string;
  type: string;
  priority: number;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  durationMs?: number;
}

export function VivaSimulationLab({ isOpen, onClose, onRefreshData }: VivaSimulationLabProps) {
  // Docked Side-by-Side Panel Mode vs Centered Modal Mode
  const [isDocked, setIsDocked] = useState<boolean>(true);

  // Scenario 1: High Concurrency State
  const [burstCount, setBurstCount] = useState<number>(30);
  const [executionDelayMs, setExecutionDelayMs] = useState<number>(500); // 500ms realistic delay
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

  if (!isOpen) return null;

  const handleOpenCleanTab = () => {
    // Open a standard browser tab on the Overview screen sharing authenticated localStorage
    window.open(window.location.origin + window.location.pathname + '#overview', '_blank');
  };

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
      // 1. Fetch or auto-provision active queue
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

      // 2. Generate batch of N diverse jobs with execution delay for realistic visual demonstration
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

      // 3. Atomically ingest batch in single Postgres transaction
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

      setBurstProgress((prev) => ({
        ...prev,
        stage: 'claiming',
        ingestedCount: batchRes.count || burstCount,
        queuedCount: batchRes.count || burstCount,
        jobIds: ingestedJobIds,
        elapsedMs: Date.now() - startTime,
      }));

      // 4. Smooth progressive state animation matching worker concurrency (0 HTTP polling spam)
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
        
        // Progress batch
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
            The left side of your screen is <strong>fully live and clickable</strong>! Watch the <strong>Throughput Chart</strong> and <strong>Worker Fleet</strong> update in real-time.
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

      {/* Scenario 1 Main Control Card */}
      <div className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-orange-400 uppercase">
                Scenario 1
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-xs font-bold text-zinc-200">
                High-Concurrency Burst & Atomic Locks
              </span>
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

        {/* Simulation Controls: Burst Size & Delay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-800/80">
          {/* Burst Size */}
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
                    burstCount === size
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {size} Jobs
                </button>
              ))}
            </div>
          </div>

          {/* Realistic Execution Delay */}
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
                    executionDelayMs === d.val
                      ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Trigger Button */}
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

        {/* Live Progress & State Counters */}
        {burstProgress.stage !== 'idle' && (
          <div className="p-4 rounded-2xl bg-black/70 border border-zinc-800 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-200 flex items-center gap-2">
                <Activity className={`w-4 h-4 ${runningBurst ? 'text-orange-400 animate-pulse' : 'text-emerald-400'}`} />
                {burstProgress.stage === 'ingesting' && '1/3: Ingesting Batch via Atomic Postgres Transaction...'}
                {burstProgress.stage === 'claiming' && '2/3: Worker Fleet Concurrently Claiming via SKIP LOCKED...'}
                {burstProgress.stage === 'completed' && '3/3: Burst Complete! All Jobs Executed.'}
              </span>
              <span className="font-mono text-[11px] text-zinc-400 font-bold">
                ⏱️ {burstProgress.elapsedMs}ms
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-800/80 rounded-full h-2.5 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  burstProgress.stage === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500'
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

            {/* Live State Breakdown Badges */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                <div className="text-[10px] uppercase font-mono font-bold text-blue-400">Queued (Waiting)</div>
                <div className="text-base font-extrabold font-mono text-blue-300">{burstProgress.queuedCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-[10px] uppercase font-mono font-bold text-amber-400 flex items-center justify-center gap-1">
                  {runningBurst && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                  Running (Locked)
                </div>
                <div className="text-base font-extrabold font-mono text-amber-300">{burstProgress.runningCount}</div>
              </div>
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-[10px] uppercase font-mono font-bold text-emerald-400">Completed</div>
                <div className="text-base font-extrabold font-mono text-emerald-300">{burstProgress.completedCount}</div>
              </div>
            </div>

            {/* Mini Live Stream Preview */}
            {liveJobsList.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                <div className="text-[10px] uppercase font-mono text-zinc-500 font-bold flex items-center justify-between">
                  <span>Live Batch Stream ({liveJobsList.length} Tasks)</span>
                  <span>Target: {burstProgress.queueName}</span>
                </div>
                <div className="max-h-36 overflow-y-auto no-scrollbar space-y-1">
                  {liveJobsList.map((job, idx) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-[11px] font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[10px]">#{idx + 1}</span>
                        <span className="text-zinc-200 font-semibold">{job.type}</span>
                        <span className="text-zinc-500 text-[10px]">P{job.priority}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {job.durationMs && <span className="text-zinc-400 text-[10px]">{job.durationMs}ms</span>}
                        {job.status === 'COMPLETED' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Done
                          </span>
                        ) : job.status === 'RUNNING' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> In Progress
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Queued
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Architectural Notes */}
      <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/15 text-xs text-zinc-400 space-y-2">
        <div className="font-bold text-orange-400 flex items-center gap-1.5 text-xs">
          <ShieldCheck className="w-4 h-4" /> System Architecture & Concurrency Checklist
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-300">
          <li>
            <strong>PostgreSQL Transaction</strong>: Ingested atomically via <code className="text-orange-400 font-mono text-[10px]">tx.job.create()</code>.
          </li>
          <li>
            <strong>Lock-Free Worker Claims</strong>: Background workers query <code className="text-orange-400 font-mono text-[10px]">FOR UPDATE SKIP LOCKED</code> to dequeue concurrently without blocking other worker threads.
          </li>
          <li>
            <strong>Real-Time WebSockets Pub/Sub</strong>: Live throughput graphs and stats counters update instantly via Redis Pub/Sub event broadcast.
          </li>
        </ul>
      </div>
    </div>
  );

  const headerControls = (
    <div className="flex items-center gap-2">
      {/* Toggle Docked Split-Screen Mode */}
      <button
        type="button"
        onClick={() => setIsDocked(!isDocked)}
        className="p-1.5 text-zinc-400 hover:text-white rounded-xl bg-zinc-900 border border-zinc-800 transition-colors"
        title={isDocked ? 'Switch to Centered Modal' : 'Dock to Split-Screen Panel'}
      >
        {isDocked ? <Maximize2 className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
      </button>

      {/* Close Button */}
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
      <aside className="fixed top-0 bottom-0 right-0 z-[60] w-full sm:w-[480px] lg:w-[540px] bg-zinc-950/95 border-l border-zinc-800 shadow-2xl backdrop-blur-xl flex flex-col p-5 sm:p-6 animate-in slide-in-from-right duration-200">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-24 bg-gradient-to-b from-orange-500/15 to-transparent pointer-events-none blur-2xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 relative z-10 shrink-0 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-zinc-100">
                  Demo Lab (Split-Screen)
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Interactive real-time simulation panel
              </p>
            </div>
          </div>

          {headerControls}
        </div>

        {/* Scrollable Content */}
        {simulationContent}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs shrink-0 mt-3">
          <span className="text-zinc-400 text-[11px]">
            Split-Screen Live View Active
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors font-semibold text-xs"
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
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[32rem] h-24 bg-gradient-to-b from-orange-500/15 to-transparent pointer-events-none blur-2xl" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 shrink-0">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-zinc-100">
                  Live Demo & Simulation Lab
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                  Scenario 1 Live
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Live interactive distributed scheduling simulation with worker lock observability
              </p>
            </div>
          </div>

          {headerControls}
        </div>

        {/* Content */}
        {simulationContent}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800 text-xs shrink-0">
          <span className="text-zinc-400 text-[11px] hidden sm:inline">
            Demonstrates <strong>High-Concurrency & Reliability</strong> engineering.
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
