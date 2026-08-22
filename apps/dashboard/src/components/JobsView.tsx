import React, { useState, useEffect } from 'react';
import { Search, Eye, RefreshCw, X, FileText, CheckCircle2, AlertTriangle, Clock, Terminal, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchApi } from '../services/api.js';

interface JobItem {
  id: string;
  type: string;
  queueId: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  createdAt: string;
  payload: Record<string, unknown>;
  queue?: { name: string };
  executions?: Array<{ id: string; attemptNumber: number; status: string; durationMs: number; errorReason?: string }>;
  logs?: Array<{ timestamp: string; level: string; message: string }>;
}

interface JobsViewProps {
  jobs: JobItem[];
  onRefresh: () => void;
}

export const JobsView: React.FC<JobsViewProps> = ({ onRefresh }) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [serverJobs, setServerJobs] = useState<JobItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const fetchServerJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });

      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const data = await fetchApi<{ jobs: JobItem[]; pagination: { total: number; totalPages: number } }>(
        `/jobs?${params.toString()}`
      );

      setServerJobs(data.jobs || []);
      setTotalCount(data.pagination?.total || 0);
      setTotalPages(Math.max(1, data.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Error fetching server jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerJobs();
  }, [currentPage, selectedStatus, searchQuery]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const inspectJob = async (jobId: string) => {
    try {
      const data = await fetchApi<{ job: JobItem }>(`/jobs/${jobId}`);
      setSelectedJob(data.job);
    } catch (err: any) {
      alert(`Error fetching job details: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-blue-500/10';
      case 'RUNNING':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-rose-500/10';
      case 'RETRYING':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-indigo-500/10';
      case 'DEAD':
        return 'bg-rose-950/60 text-rose-400 border-rose-800/80';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-6">
      {/* Header Search & Filter Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search jobs by ID or handler type..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
          {['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD'].map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                selectedStatus === status
                  ? 'bg-brand-600 text-white border-brand-500 shadow-lg shadow-brand-500/25'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {status}
            </button>
          ))}
          <button
            onClick={() => {
              fetchServerJobs();
              onRefresh();
            }}
            className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors ml-2 shadow-md"
            title="Refresh Jobs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Jobs Data Table — Server-Side Paginated */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-4 px-6">Job UUID</th>
                <th className="py-4 px-6">Handler Type</th>
                <th className="py-4 px-6">Lifecycle Status</th>
                <th className="py-4 px-6">Priority</th>
                <th className="py-4 px-6">Attempts</th>
                <th className="py-4 px-6">Created Timestamp</th>
                <th className="py-4 px-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {serverJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-6 font-mono text-xs text-brand-400 font-semibold">
                    {job.id}
                  </td>
                  <td className="py-4 px-6 font-semibold text-white">
                    <span className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-indigo-300">
                      {job.type}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-mono text-slate-200 font-bold">{job.priority}</td>
                  <td className="py-4 px-6 text-slate-400 font-mono text-xs">
                    {job.attempts} / {job.maxAttempts}
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-400 font-mono">
                    {new Date(job.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => inspectJob(job.id)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 shadow-md"
                      title="Inspect Job Logs & Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {serverJobs.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No jobs found matching your search and status filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        {totalCount > 0 && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-400 font-mono">
              Showing <strong className="text-white">{startIndex + 1}</strong> to{' '}
              <strong className="text-white">{Math.min(startIndex + pageSize, totalCount)}</strong> of{' '}
              <strong className="text-white">{totalCount.toLocaleString()}</strong> Jobs (Server-Side Paginated)
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
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
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job Details & Log Stream Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-dark-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brand-500/10 text-brand-400 rounded-2xl border border-brand-500/20">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Job Details & Microsecond Logs</h3>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">{selectedJob.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Input Payload (JSON)</h4>
                <pre className="bg-slate-950 p-4 rounded-2xl text-xs text-emerald-400 overflow-x-auto border border-slate-800/80 font-mono shadow-inner">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>

              {selectedJob.executions && selectedJob.executions.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Execution Attempt History</h4>
                  <div className="space-y-2">
                    {selectedJob.executions.map((exec) => (
                      <div key={exec.id} className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-200">Attempt #{exec.attemptNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(exec.status)}`}>{exec.status}</span>
                        <span className="font-mono text-slate-400">{exec.durationMs ? `${exec.durationMs}ms` : 'In progress'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Microsecond Execution Log Stream</h4>
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 font-mono text-xs max-h-60 overflow-y-auto shadow-inner">
                  {selectedJob.logs && selectedJob.logs.length > 0 ? (
                    selectedJob.logs.map((log, idx) => (
                      <div key={idx} className="flex gap-3">
                        <span className="text-slate-500 select-none">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={log.level === 'ERROR' ? 'text-rose-400' : log.level === 'WARN' ? 'text-amber-400' : 'text-slate-300'}>
                          [{log.level}] {log.message}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">No logs generated yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
