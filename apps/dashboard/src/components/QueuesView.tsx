import React, { useState } from 'react';
import { PauseCircle, PlayCircle, Shield, Layers, Server, ChevronLeft, ChevronRight, Plus, X, Send } from 'lucide-react';
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // New queue form state
  const [queueName, setQueueName] = useState<string>('');
  const [priority, setPriority] = useState<number>(20);
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(5);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(queues.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedQueues = queues.slice(startIndex, startIndex + pageSize);

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

  const handleCreateQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!queueName.trim()) {
      setErrorMsg('Queue name is required');
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi('/queues', {
        method: 'POST',
        body: JSON.stringify({
          name: queueName.trim().toLowerCase().replace(/\s+/g, '-'),
          priority: Number(priority),
          concurrencyLimit: Number(concurrencyLimit),
        }),
      });

      setQueueName('');
      setIsCreateModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create queue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
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
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create New Queue
          </button>
          <div className="px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Active Queues: <strong className="text-white font-bold">{queues.filter(q => q.status === 'ACTIVE').length}</strong>
          </div>
        </div>
      </div>

      {/* Queues Data Table — Mobile Responsive Scroll */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
        <div className="overflow-x-auto flex-1">
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
              {paginatedQueues.map((queue) => (
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
                    No active queues found. Click "+ Create New Queue" above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {queues.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-400 font-mono">
              Showing <strong className="text-white">{startIndex + 1}</strong> to{' '}
              <strong className="text-white">{Math.min(startIndex + pageSize, queues.length)}</strong> of{' '}
              <strong className="text-white">{queues.length}</strong> Queues
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-slate-600 px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all ${
                          currentPage === p
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Queue Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-400" /> Create New Tenant Queue
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateQueue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Queue Name</label>
                <input
                  type="text"
                  placeholder="e.g. payment-settlements"
                  value={queueName}
                  onChange={(e) => setQueueName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Priority (1 - 100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Higher priority queues are claimed first by workers.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Worker Concurrency Limit</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={concurrencyLimit}
                  onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">Max parallel worker threads allowed for this queue.</span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-lg shadow-brand-500/20 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" /> {submitting ? 'Creating...' : 'Create Queue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
