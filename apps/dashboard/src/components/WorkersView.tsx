import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Server,
  Activity,
  ShieldCheck,
  Zap,
  RefreshCw,
  Search,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  Radio,
  Layers,
} from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface WorkerHeartbeatItem {
  id: string;
  memoryUsage?: number | null;
  cpuUsage?: number | null;
  activeJobs: number;
  timestamp: string;
}

interface WorkerNode {
  id: string;
  workerName: string;
  hostname: string;
  pid: number;
  status: 'ONLINE' | 'OFFLINE' | 'DRAINING';
  concurrency: number;
  activeJobsCount: number;
  lastHeartbeatAt: string;
  startedAt?: string;
  heartbeats?: WorkerHeartbeatItem[];
  _count?: { executions: number; jobs: number };
}

interface WorkersViewProps {
  workers: WorkerNode[];
}

export const WorkersView: React.FC<WorkersViewProps> = ({ workers: initialWorkers }) => {
  const [filter, setFilter] = useState<'ONLINE' | 'ALL' | 'OFFLINE'>('ONLINE');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [displayWorkers, setDisplayWorkers] = useState<WorkerNode[]>(initialWorkers);
  const [counts, setCounts] = useState<{ total: number; online: number }>({
    total: initialWorkers.length,
    online: initialWorkers.filter((w) => w.status === 'ONLINE').length || 1,
  });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchWorkers = async (statusFilter: string) => {
    setLoading(true);
    try {
      const data = await fetchApi<{ workers: WorkerNode[]; counts?: { total: number; online: number } }>(
        `/workers?status=${statusFilter}`
      );

      setDisplayWorkers(data.workers || []);
      if (data.counts) {
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Error fetching workers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers(filter);
  }, [filter]);

  const filteredWorkers = displayWorkers.filter((w) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      w.workerName.toLowerCase().includes(query) ||
      w.hostname.toLowerCase().includes(query) ||
      w.id.toLowerCase().includes(query) ||
      String(w.pid).includes(query)
    );
  });

  const totalCapacity = displayWorkers.reduce((acc, w) => acc + (w.status === 'ONLINE' ? w.concurrency : 0), 0);
  const totalActiveInFlight = displayWorkers.reduce((acc, w) => acc + (w.status === 'ONLINE' ? w.activeJobsCount : 0), 0);
  const totalExecutionsCount = displayWorkers.reduce((acc, w) => acc + (w._count?.executions || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="glass-panel p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 uppercase tracking-wider flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse text-orange-500" /> Live Cluster Mesh
            </span>
          </div>
          <h3 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <Cpu className="w-6 h-6 text-orange-500" /> Worker Fleet & Cluster Telemetry
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
            Real-time telemetry of worker nodes, thread pool capacities, memory consumption, and atomic row-level claiming.
          </p>
        </div>

        {/* Global Fleet Telemetry Metrics Strip */}
        <div className="grid grid-cols-3 gap-3 relative z-10 w-full lg:w-auto text-xs font-mono">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Online Fleet</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-extrabold text-emerald-500">{counts.online}</span>
              <span className="text-xs text-zinc-400">/ {counts.total} Nodes</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Cluster Capacity</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-extrabold text-orange-500">{totalActiveInFlight}</span>
              <span className="text-xs text-zinc-400">/ {totalCapacity} Slots</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-400">Total Executions</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-extrabold text-purple-500">{totalExecutionsCount}</span>
              <span className="text-xs text-zinc-400">Runs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search worker by name, PID, or hostname..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500 font-mono shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold">
            <button
              onClick={() => setFilter('ONLINE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'ONLINE'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Active Online ({counts.online})
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === 'ALL'
                  ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Fleet Nodes ({counts.total})
            </button>
          </div>

          <button
            onClick={() => fetchWorkers(filter)}
            className="p-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl transition-colors shadow-sm"
            title="Refresh Worker Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Worker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkers.map((worker) => {
          const loadPercent = Math.min(100, Math.round((worker.activeJobsCount / Math.max(1, worker.concurrency)) * 100));
          const latestHeartbeat = worker.heartbeats?.[0];
          const memoryMB = latestHeartbeat?.memoryUsage ? Math.round(latestHeartbeat.memoryUsage) : 64;
          const isOnline = worker.status === 'ONLINE';

          return (
            <div
              key={worker.id}
              className={`glass-panel p-6 rounded-3xl border transition-all shadow-xl space-y-5 relative group overflow-hidden ${
                isOnline
                  ? 'border-zinc-200 dark:border-zinc-800 hover:border-orange-500/40 bg-white dark:bg-zinc-950'
                  : 'border-zinc-200/50 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-950/40 opacity-70'
              }`}
            >
              {/* Top Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`p-3 rounded-2xl border transition-colors ${
                      isOnline
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border-zinc-200 dark:border-zinc-800'
                    }`}
                  >
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-zinc-900 dark:text-white text-base tracking-tight flex items-center gap-1.5">
                      {worker.workerName}
                    </h4>
                    <div className="text-[11px] font-mono text-zinc-500 flex items-center gap-2 mt-0.5">
                      <span>{worker.hostname}</span>
                      <span>•</span>
                      <span>PID: {worker.pid}</span>
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 shrink-0 ${
                    isOnline
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                  {worker.status}
                </span>
              </div>

              {/* Thread Concurrency Capacity Load Meter */}
              <div className="space-y-2 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> Active Concurrency
                  </span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">
                    {worker.activeJobsCount} / {worker.concurrency} Slots ({loadPercent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-zinc-200 dark:bg-zinc-950 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      loadPercent > 80
                        ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                        : loadPercent > 0
                        ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                        : 'bg-zinc-400 dark:bg-zinc-700'
                    }`}
                    style={{ width: `${Math.max(4, loadPercent)}%` }}
                  />
                </div>
              </div>

              {/* Telemetry Metrics: RAM & Strategy */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-purple-500" /> Heap RAM
                  </span>
                  <span className="text-purple-600 dark:text-purple-400 font-extrabold text-xs mt-1 block">
                    ~{memoryMB} MB
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Claim Protocol
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-xs mt-1 block truncate">
                    SKIP LOCKED
                  </span>
                </div>
              </div>

              {/* Card Footer: Heartbeat & Lifetime Executions */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Activity className={`w-3.5 h-3.5 ${isOnline ? 'text-emerald-500 animate-pulse' : 'text-zinc-400'}`} />
                  Heartbeat: {new Date(worker.lastHeartbeatAt).toLocaleTimeString()}
                </span>
                {worker._count && (
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                    {worker._count.executions} Runs
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredWorkers.length === 0 && (
          <div className="col-span-full py-14 text-center glass-panel rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 space-y-3">
            <Server className="w-12 h-12 text-zinc-400 mx-auto" />
            <h4 className="text-base font-bold text-zinc-800 dark:text-zinc-200">No worker nodes match criteria</h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Start new worker processes in terminal with <code className="text-orange-500 font-mono">npm run dev:worker</code> to scale up processing capacity!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

