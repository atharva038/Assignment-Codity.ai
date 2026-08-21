import React, { useState } from 'react';
import { AlertOctagon, RotateCcw, Archive, AlertTriangle, FileCode, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface DeadLetterItem {
  id: string;
  originalJobId: string;
  queueId: string;
  attempts: number;
  finalErrorReason?: string;
  stackTrace?: string;
  resolutionStatus: 'PENDING' | 'RETRIED' | 'ARCHIVED';
  createdAt: string;
  originalJob?: { type: string; payload: Record<string, unknown> };
}

interface DlqViewProps {
  dlqJobs: DeadLetterItem[];
  onRefresh: () => void;
}

export const DlqView: React.FC<DlqViewProps> = ({ dlqJobs, onRefresh }) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const replayJob = async (dlqId: string) => {
    setActionLoadingId(dlqId);
    try {
      await fetchApi(`/dlq/${dlqId}/retry`, { method: 'POST' });
      alert('Job successfully replayed back into QUEUED state!');
      onRefresh();
    } catch (err: any) {
      alert(`Error replaying DLQ job: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const archiveJob = async (dlqId: string) => {
    setActionLoadingId(dlqId);
    try {
      await fetchApi(`/dlq/${dlqId}/archive`, { method: 'POST' });
      onRefresh();
    } catch (err: any) {
      alert(`Error archiving DLQ job: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <AlertOctagon className="w-6 h-6 text-rose-500" /> Dead Letter Queue (DLQ) Management
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Inspect jobs that permanently exhausted all retry attempts. Replay them back to QUEUED status or archive them.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <span className="px-4 py-2 bg-rose-950/60 border border-rose-900/60 rounded-xl text-xs text-rose-300 font-mono font-bold flex items-center gap-2">
            Pending DLQ Entries: {dlqJobs.filter(d => d.resolutionStatus === 'PENDING').length}
          </span>
        </div>
      </div>

      {/* DLQ Data Table — Mobile Responsive Scroll */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="py-4 px-6">Original Job ID</th>
              <th className="py-4 px-6">Handler Type</th>
              <th className="py-4 px-6">Attempts</th>
              <th className="py-4 px-6">Final Error Reason</th>
              <th className="py-4 px-6">Resolution</th>
              <th className="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-sm">
            {dlqJobs.map((item) => (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-6 font-mono text-xs text-rose-400 font-bold">
                    {item.originalJobId}
                  </td>
                  <td className="py-4 px-6 font-semibold text-white">
                    <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300">
                      {item.originalJob?.type || 'Unknown'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-300 font-mono text-xs">{item.attempts} Attempts Exhausted</td>
                  <td className="py-4 px-6 max-w-xs text-xs text-rose-300 font-mono truncate" title={item.finalErrorReason}>
                    {item.finalErrorReason || 'Fatal execution failure'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      item.resolutionStatus === 'PENDING'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : item.resolutionStatus === 'RETRIED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {item.resolutionStatus}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right space-x-2">
                    {item.resolutionStatus === 'PENDING' && (
                      <>
                        <button
                          onClick={() => replayJob(item.id)}
                          disabled={actionLoadingId === item.id}
                          className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Replay
                        </button>
                        <button
                          onClick={() => archiveJob(item.id)}
                          disabled={actionLoadingId === item.id}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-all shadow-md"
                        >
                          <Archive className="w-3.5 h-3.5 inline mr-1" /> Archive
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {dlqJobs.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <AlertOctagon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  Dead Letter Queue is empty! No jobs permanently failed.
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
