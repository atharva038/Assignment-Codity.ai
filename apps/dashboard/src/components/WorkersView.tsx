import React, { useState, useEffect } from 'react';
import { Cpu, Server, Activity, ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface WorkerNode {
  id: string;
  workerName: string;
  hostname: string;
  status: 'ONLINE' | 'OFFLINE' | 'DRAINING';
  concurrency: number;
  activeJobsCount: number;
  lastHeartbeatAt: string;
}

interface WorkersViewProps {
  workers: WorkerNode[];
}

export const WorkersView: React.FC<WorkersViewProps> = ({ workers: initialWorkers }) => {
  const [filter, setFilter] = useState<'ONLINE' | 'ALL'>('ONLINE');
  const [displayWorkers, setDisplayWorkers] = useState<WorkerNode[]>(initialWorkers);
  const [counts, setCounts] = useState<{ total: number; online: number }>({
    total: initialWorkers.length,
    online: initialWorkers.filter(w => w.status === 'ONLINE').length || 1,
  });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchWorkers = async (statusFilter: 'ONLINE' | 'ALL') => {
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" /> Worker Fleet & Cluster Telemetry
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live telemetry monitoring of active worker nodes, concurrent thread capacities, heartbeats, and cluster load balancing.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {/* Filter Toggle Buttons with Exact Separate Counts */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilter('ONLINE')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'ONLINE' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Online Only ({counts.online})
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'ALL' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Fleet Nodes ({counts.total})
            </button>
          </div>

          <button
            onClick={() => fetchWorkers(filter)}
            className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors"
            title="Refresh Workers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Worker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayWorkers.map((worker) => (
          <div key={worker.id} className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-indigo-500/30 transition-all shadow-xl space-y-4 relative group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl border ${
                  worker.status === 'ONLINE' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-base tracking-tight">{worker.workerName}</h4>
                  <span className="text-xs font-mono text-slate-500">{worker.hostname}</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                worker.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${worker.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                {worker.status}
              </span>
            </div>

            {/* Thread Load Capacity */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Thread Capacity Load</span>
                <span className="text-amber-400 font-bold">{worker.activeJobsCount} / {worker.concurrency} Active</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (worker.activeJobsCount / worker.concurrency) * 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Strategy & Threads */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Claim Strategy</span>
                <span className="font-mono text-slate-200 font-bold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> SKIP LOCKED
                </span>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Worker Threads</span>
                <span className="font-mono text-indigo-300 font-bold flex items-center gap-1 mt-0.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" /> {worker.concurrency} Threads
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Heartbeat
              </span>
              <span>{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
        {displayWorkers.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 glass-panel rounded-2xl border border-slate-800">
            <Server className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            No worker nodes matching filter criteria. Start a worker process via `npm run dev:worker`!
          </div>
        )}
      </div>
    </div>
  );
};
