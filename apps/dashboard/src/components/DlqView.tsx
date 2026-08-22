import React, { useState } from 'react';
import {
  AlertOctagon,
  RotateCcw,
  Archive,
  AlertTriangle,
  FileCode,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BrainCircuit,
  Wand2,
  CheckCircle2,
  X,
  ShieldAlert,
  Terminal,
  Layers,
  Clock,
  Cpu,
  Copy,
  Check
} from 'lucide-react';
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
  aiSummary?: string;
  aiSuggestedFix?: string;
  aiAnalyzedAt?: string;
  aiSource?: 'OPENAI' | 'GEMINI' | 'HEURISTIC_ENGINE';
  originalJob?: { type: string; payload: Record<string, unknown> };
}

interface DlqViewProps {
  dlqJobs: DeadLetterItem[];
  onRefresh: () => void;
}

export const DlqView: React.FC<DlqViewProps> = ({ dlqJobs, onRefresh }) => {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [aiModalItem, setAiModalItem] = useState<DeadLetterItem | null>(null);
  const [generatingAiId, setGeneratingAiId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'trace' | 'payload' | 'metadata'>('trace');
  const [copiedId, setCopiedId] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(dlqJobs.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedDlqJobs = dlqJobs.slice(startIndex, startIndex + pageSize);

  const generateAiSummary = async (item: DeadLetterItem) => {
    setGeneratingAiId(item.id);
    try {
      const res = await fetchApi<{
        diagnostic: { summary: string; suggestedFix: string; analyzedAt: string; source: 'OPENAI' | 'GEMINI' | 'HEURISTIC_ENGINE' };
        deadLetterJob: DeadLetterItem;
      }>(`/dlq/${item.id}/ai-summary`, { method: 'POST' });
      setAiModalItem({
        ...item,
        aiSummary: res.diagnostic.summary,
        aiSuggestedFix: res.diagnostic.suggestedFix,
        aiAnalyzedAt: res.diagnostic.analyzedAt,
        aiSource: res.diagnostic.source,
      });
      onRefresh();
    } catch (err: any) {
      alert(`Error generating failure summary: ${err.message}`);
    } finally {
      setGeneratingAiId(null);
    }
  };

  const replayJob = async (dlqId: string) => {
    setActionLoadingId(dlqId);
    try {
      await fetchApi(`/dlq/${dlqId}/retry`, { method: 'POST' });
      alert('Job successfully replayed back into QUEUED state!');
      onRefresh();
      if (aiModalItem?.id === dlqId) setAiModalItem(null);
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
      if (aiModalItem?.id === dlqId) setAiModalItem(null);
    } catch (err: any) {
      alert(`Error archiving DLQ job: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const parseResolutionSteps = (fixText?: string): string[] => {
    if (!fixText) return ['Inspect job payload parameters.', 'Click Replay to re-enqueue.'];
    return fixText
      .split('\n')
      .map((s) => s.replace(/^\d+\.\s*/, '').trim())
      .filter((s) => s.length > 0);
  };

  return (
    <div className="space-y-6">
      {/* Minimalist Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-[#E7E2D9] dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-stone-900 dark:text-white flex items-center gap-2.5">
              Dead Letter Queue (DLQ) & Incident Diagnostics
            </h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 mt-0.5 max-w-2xl font-medium">
              Inspect jobs that permanently exhausted retry limits. View automated root-cause diagnostics, stack traces, and resolution steps.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <span className="px-4 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-xs text-orange-600 dark:text-orange-400 font-mono font-bold flex items-center gap-2">
            Pending DLQ Entries: {dlqJobs.filter((d) => d.resolutionStatus === 'PENDING').length}
          </span>
        </div>
      </div>

      {/* Minimalist DLQ Data Table */}
      <div className="glass-panel rounded-3xl overflow-hidden border border-[#E7E2D9] dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-xl flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-[#E7E2D9] dark:border-zinc-800 bg-[#F5F0E6] dark:bg-zinc-950/80 text-[11px] font-mono font-bold uppercase tracking-wider text-stone-800 dark:text-zinc-400">
                <th className="py-4 px-6">Original Job ID</th>
                <th className="py-4 px-6">Handler Type</th>
                <th className="py-4 px-6">Attempts</th>
                <th className="py-4 px-6">Final Error Reason</th>
                <th className="py-4 px-6">Failure Diagnostics</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E2D9]/80 dark:divide-zinc-800/60 text-sm">
              {paginatedDlqJobs.map((item) => (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-[#F5F0E6]/50 dark:hover:bg-zinc-900/50 transition-colors text-stone-900 dark:text-zinc-200">
                    <td className="py-4 px-6 font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                      {item.originalJobId.slice(0, 16)}...
                    </td>
                    <td className="py-4 px-6 font-semibold">
                      <span className="px-3 py-1 bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-full text-xs font-mono text-stone-800 dark:text-zinc-300">
                        {item.originalJob?.type || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-stone-800 dark:text-zinc-300 font-mono text-xs font-bold">{item.attempts} Attempts</td>
                    <td className="py-4 px-6 max-w-xs text-xs text-rose-700 dark:text-rose-400 font-mono font-semibold truncate" title={item.finalErrorReason}>
                      {item.finalErrorReason || 'Fatal execution failure'}
                    </td>
                    <td className="py-4 px-6">
                      {item.aiSummary ? (
                        <button
                          onClick={() => {
                            setAiModalItem(item);
                            setActiveTab('trace');
                          }}
                          className="px-3.5 py-1.5 bg-orange-50 hover:bg-orange-100 dark:bg-zinc-900 dark:hover:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <FileCode className="w-3.5 h-3.5 text-orange-500" /> Inspect Incident
                        </button>
                      ) : (
                        <button
                          onClick={() => generateAiSummary(item)}
                          disabled={generatingAiId === item.id}
                          className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-orange-500/20"
                        >
                          <Wand2 className={`w-3.5 h-3.5 ${generatingAiId === item.id ? 'animate-spin' : ''}`} />
                          {generatingAiId === item.id ? 'Analyzing...' : 'Diagnose'}
                        </button>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          item.resolutionStatus === 'PENDING'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30'
                            : item.resolutionStatus === 'RETRIED'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-400 border-stone-300 dark:border-zinc-700'
                        }`}
                      >
                        {item.resolutionStatus}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      {item.resolutionStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => replayJob(item.id)}
                            disabled={actionLoadingId === item.id}
                            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-full text-xs font-bold transition-all shadow-sm"
                          >
                            <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Replay
                          </button>
                          <button
                            onClick={() => archiveJob(item.id)}
                            disabled={actionLoadingId === item.id}
                            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-stone-700 dark:text-zinc-300 border border-stone-200 dark:border-zinc-800 rounded-full text-xs font-bold transition-all shadow-sm"
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
                  <td colSpan={7} className="py-12 text-center text-stone-500 dark:text-zinc-500">
                    <AlertOctagon className="w-10 h-10 text-stone-400 dark:text-zinc-700 mx-auto mb-3" />
                    Dead Letter Queue is empty! No jobs permanently failed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Minimalist Pagination Footer */}
        {dlqJobs.length > 0 && (
          <div className="px-6 py-4 border-t border-[#E7E2D9] dark:border-zinc-800 bg-[#F5F0E6] dark:bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-stone-700 dark:text-zinc-400 font-mono font-medium">
              Showing <strong className="text-stone-900 dark:text-white">{startIndex + 1}</strong> to{' '}
              <strong className="text-stone-900 dark:text-white">{Math.min(startIndex + pageSize, dlqJobs.length)}</strong> of{' '}
              <strong className="text-stone-900 dark:text-white">{dlqJobs.length}</strong> Dead Jobs
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-800 text-stone-800 dark:text-zinc-300 hover:text-stone-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && <span className="text-zinc-400 px-1">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={`w-8 h-8 rounded-full font-mono text-xs font-bold transition-all ${
                          currentPage === p
                            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                            : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
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
                className="px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all shadow-sm"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enterprise Failure Incident Inspector Modal */}
      {aiModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Failure Incident Inspector</h3>
                    <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/30 rounded-full text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase">
                      CRASH EXCEPTION
                    </span>
                    {aiModalItem.aiSource === 'OPENAI' ? (
                      <span className="px-2.5 py-0.5 bg-orange-500/10 border border-orange-500/40 rounded-full text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-orange-500" /> ✨ OpenAI GPT-4o-Mini
                      </span>
                    ) : aiModalItem.aiSource === 'GEMINI' ? (
                      <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/40 rounded-full text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-500" /> ♊ Gemini AI
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-zinc-500" /> ⚡ Heuristic Engine
                      </span>
                    )}
                    <button
                      onClick={() => generateAiSummary(aiModalItem)}
                      disabled={generatingAiId === aiModalItem.id}
                      className="px-3 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-[10px] font-mono font-bold transition-all flex items-center gap-1 shadow-sm"
                      title="Re-run analysis with your OpenAI Key"
                    >
                      <Wand2 className={`w-3 h-3 ${generatingAiId === aiModalItem.id ? 'animate-spin' : ''}`} />
                      {generatingAiId === aiModalItem.id ? 'Re-analyzing...' : 'Re-analyze'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">Job ID: {aiModalItem.originalJobId}</span>
                    <button
                      onClick={() => copyToClipboard(aiModalItem.originalJobId)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      title="Copy Job ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setAiModalItem(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Root Cause Diagnosis Section */}
            <div className="space-y-4">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5 font-mono">
                    <Terminal className="w-3.5 h-3.5" /> Primary Root Cause
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Type: <strong className="text-zinc-800 dark:text-zinc-300">{aiModalItem.originalJob?.type || 'Standard'}</strong>
                  </span>
                </div>
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                  {aiModalItem.aiSummary || 'Job execution failed after exhausting maximum retry attempts.'}
                </p>
              </div>

              {/* Recommended Action Checklist */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Recommended Resolution Steps
                </span>
                <div className="space-y-2">
                  {parseResolutionSteps(aiModalItem.aiSuggestedFix).map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-mono bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-sm">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="pt-0.5 leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnostic Tabs */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <button
                    onClick={() => setActiveTab('trace')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'trace'
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" /> Stack Trace
                  </button>
                  <button
                    onClick={() => setActiveTab('payload')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'payload'
                        ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Input Payload
                  </button>
                  <button
                    onClick={() => setActiveTab('metadata')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'metadata'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" /> Metadata
                  </button>
                </div>

                {/* Tab Content */}
                <div className="bg-zinc-100 dark:bg-zinc-950 p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 font-mono text-xs min-h-[120px] max-h-[180px] overflow-y-auto scrollbar-thin">
                  {activeTab === 'trace' && (
                    <pre className="text-rose-600 dark:text-rose-400 whitespace-pre-wrap">
                      {aiModalItem.stackTrace || aiModalItem.finalErrorReason || 'No stack trace captured for this failure.'}
                    </pre>
                  )}
                  {activeTab === 'payload' && (
                    <pre className="text-orange-600 dark:text-orange-300 whitespace-pre-wrap">
                      {JSON.stringify(aiModalItem.originalJob?.payload || {}, null, 2)}
                    </pre>
                  )}
                  {activeTab === 'metadata' && (
                    <div className="space-y-1 text-zinc-700 dark:text-zinc-300">
                      <div><span className="text-zinc-500">DLQ Entry ID:</span> {aiModalItem.id}</div>
                      <div><span className="text-zinc-500">Queue ID:</span> {aiModalItem.queueId}</div>
                      <div><span className="text-zinc-500">Attempts Exhausted:</span> {aiModalItem.attempts}</div>
                      <div><span className="text-zinc-500">Resolution Status:</span> {aiModalItem.resolutionStatus}</div>
                      <div><span className="text-zinc-500">Created At:</span> {new Date(aiModalItem.createdAt).toLocaleString()}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Analyzed: {aiModalItem.aiAnalyzedAt ? new Date(aiModalItem.aiAnalyzedAt).toLocaleString() : 'Just now'}
              </span>
              <div className="flex items-center gap-2">
                {aiModalItem.resolutionStatus === 'PENDING' && (
                  <button
                    onClick={() => replayJob(aiModalItem.id)}
                    disabled={actionLoadingId === aiModalItem.id}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Replay Job
                  </button>
                )}
                <button
                  onClick={() => setAiModalItem(null)}
                  className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
