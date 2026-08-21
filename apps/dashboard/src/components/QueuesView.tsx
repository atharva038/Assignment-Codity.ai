import React, { useState } from 'react';
import { PauseCircle, PlayCircle, Shield, Layers, Zap, Sliders, Server, ArrowUpRight } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface QueueItem {
  id: string;
  name: string;
  priority: number;
  concurrencyLimit: number;
  status: 'ACTIVE' | 'PAUSED';
  retryPolicy?: { name: string; type: string; maxAttempts: number };
  _count?: { jobs: number };
}

interface QueuesViewProps {
  queues: QueueItem[];
  onRefresh: () => void;
}

export const QueuesView: React.FC<QueuesViewProps> = ({ queues, onRefresh }) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toggleQueueStatus = async (queue: QueueItem) => {
    setLoadingId(queue.id);
    try {
      const endpoint = queue.status === 'ACTIVE' ? `/queues/${queue.id}/pause` : `/queues/${queue.id}/resume`;
      await fetchApi(endpoint, { method: 'POST' });
      onRefresh();
    } catch (err: any) {
      alert(`Error toggling queue status: ${err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-brand-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-brand-400" /> Queue Fleet & Concurrency Controls
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Manage workload priorities, enforce worker thread concurrency limits, and pause/resume claim polling per tenant queue.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Total Active Queues: <strong className="text-white font-bold">{queues.filter(q => q.status === 'ACTIVE').length}</strong>
          </div>
        </div>
      </div>

      {/* Queues Data Table — Mobile Responsive Scroll */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-4 px-6">Queue Details</th>
              <th className="py-4 px-6">Polling Status</th>
              <th className="py-4 px-6">Priority Level</th>
              <th className="py-4 px-6">Concurrency Limit</th>
              <th className="py-4 px-6">Retry Policy</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {queues.map((queue) => (
              <tr key={queue.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="py-4 px-6">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20 group-hover:scale-105 transition-transform">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block font-bold text-white text-base tracking-tight">{queue.name}</span>
                      <span className="text-[11px] font-mono text-slate-500">ID: {queue.id}</span>
                    </div>
                  </div>
                </td>

                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border ${
                    queue.status === 'ACTIVE' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-sm shadow-emerald-500/10' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-sm shadow-amber-500/10'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${queue.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                    {queue.status}
                  </span>
                </td>

                <td className="py-4 px-6">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-200 font-bold bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 shadow-inner">
                      Priority {queue.priority}
                    </span>
                  </div>
                </td>

                <td className="py-4 px-6">
                  <span className="font-mono text-indigo-300 font-bold bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-900/50 inline-flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-indigo-400" />
                    {queue.concurrencyLimit} Worker Threads
                  </span>
                </td>

                <td className="py-4 px-6">
                  {queue.retryPolicy ? (
                    <span className="inline-flex items-center gap-1.5 text-xs bg-slate-900 px-3 py-1 rounded-lg text-slate-300 border border-slate-800">
                      <Shield className="w-3.5 h-3.5 text-brand-400" />
                      {queue.retryPolicy.name} ({queue.retryPolicy.maxAttempts}x Max)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2.5 py-1 rounded-md border border-slate-800">
                      Standard (3x Exponential)
                    </span>
                  )}
                </td>

                <td className="py-4 px-6 text-right">
                  <button
                    onClick={() => toggleQueueStatus(queue)}
                    disabled={loadingId === queue.id}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                      queue.status === 'ACTIVE'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 shadow-amber-500/10'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 shadow-emerald-500/10'
                    }`}
                  >
                    {queue.status === 'ACTIVE' ? (
                      <>
                        <PauseCircle className="w-4 h-4 text-amber-400" /> Pause Queue
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 text-emerald-400" /> Resume Queue
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {queues.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <Layers className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  No active queues found. Create queues via REST API or Database Seeder.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
