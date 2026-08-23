import React, { useState, useEffect } from 'react';
import {
  Search,
  Eye,
  RefreshCw,
  X,
  FileText,
  Clock,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Zap,
  PlayCircle,
  PauseCircle,
  Calendar,
  Layers,
} from 'lucide-react';
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

interface ScheduledJobItem {
  id: string;
  name: string;
  cronExpression: string;
  jobType: string;
  priority: number;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  payload: Record<string, unknown>;
  queue?: { id: string; name: string };
  project?: { id: string; name: string; slug: string };
  createdAt: string;
}

interface JobsViewProps {
  jobs: JobItem[];
  onRefresh: () => void;
  lastUpdatedTs?: number;
  lastWsEvent?: any;
}

export const JobsView: React.FC<JobsViewProps> = ({ onRefresh, lastUpdatedTs, lastWsEvent }) => {
  const [activeSubTab, setActiveSubTab] = useState<'INSTANCES' | 'CRON_SCHEDULES'>('INSTANCES');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Server-side pagination state for jobs
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize] = useState<number>(10);
  const [serverJobs, setServerJobs] = useState<JobItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Scheduled cron jobs state
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJobItem[]>([]);
  const [loadingCrons, setLoadingCrons] = useState<boolean>(false);
  const [togglingCronId, setTogglingCronId] = useState<string | null>(null);

  const fetchServerJobs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
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
      if (!isBackground) setLoading(false);
    }
  };

  const fetchScheduledJobs = async () => {
    setLoadingCrons(true);
    try {
      const data = await fetchApi<{ scheduledJobs: ScheduledJobItem[] }>('/scheduled-jobs');
      setScheduledJobs(data.scheduledJobs || []);
    } catch (err) {
      console.error('Error fetching scheduled cron jobs:', err);
    } finally {
      setLoadingCrons(false);
    }
  };

  useEffect(() => {
    fetchServerJobs(false);
  }, [currentPage, selectedStatus, searchQuery]);

  useEffect(() => {
    if (activeSubTab === 'CRON_SCHEDULES') {
      fetchScheduledJobs();
    }
  }, [activeSubTab]);

  // In-Memory WebSocket Reactive Update
  useEffect(() => {
    if (!lastWsEvent) return;

    if (lastWsEvent.type === 'job:updated' && lastWsEvent.payload) {
      const { jobId, status, durationMs, batchSize, scheduledJobId } = lastWsEvent.payload;

      if (activeSubTab === 'CRON_SCHEDULES' || scheduledJobId) {
        fetchScheduledJobs();
      }

      if (batchSize) {
        fetchServerJobs(true);
        return;
      }

      if (jobId && status) {
        setServerJobs((prev) =>
          prev.map((job) =>
            job.id === jobId
              ? {
                  ...job,
                  status,
                  executions: durationMs
                    ? [{ id: `exec-${Date.now()}`, attemptNumber: job.attempts || 1, status, durationMs }]
                    : job.executions,
                }
              : job
          )
        );
      }
    } else if (lastWsEvent.type === 'stats:snapshot') {
      if (activeSubTab === 'CRON_SCHEDULES') {
        fetchScheduledJobs();
      }
    }
  }, [lastWsEvent, activeSubTab]);

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

  const handleToggleCron = async (cronJob: ScheduledJobItem) => {
    setTogglingCronId(cronJob.id);
    try {
      await fetchApi(`/scheduled-jobs/${cronJob.id}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !cronJob.enabled }),
      });
      await fetchScheduledJobs();
    } catch (err: any) {
      alert(`Failed to toggle cron schedule: ${err.message}`);
    } finally {
      setTogglingCronId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'SCHEDULED':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'RUNNING':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'RETRYING':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30';
      case 'DEAD':
        return 'bg-rose-950/40 text-rose-500 border-rose-800/80';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  };

  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-6">
      {/* Top Tab Switcher */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <button
            onClick={() => setActiveSubTab('INSTANCES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'INSTANCES'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" /> Executed Job Instances
          </button>
          <button
            onClick={() => setActiveSubTab('CRON_SCHEDULES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeSubTab === 'CRON_SCHEDULES'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Repeat className="w-4 h-4" /> Recurring Cron Schedules
            {scheduledJobs.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-900/40 text-purple-200 font-mono">
                {scheduledJobs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeSubTab === 'INSTANCES' ? (
        <>
          {/* Header Search & Filter Bar */}
          <div className="glass-panel p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 absolute left-4 top-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search jobs by ID or handler type..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full pl-11 pr-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors shadow-inner"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {['ALL', 'QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'DEAD'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${
                    selectedStatus === status
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
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
                className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors ml-2 shadow-sm"
                title="Refresh Jobs"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Jobs Data Table */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-xl flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/80 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    <th className="py-4 px-6">Job UUID</th>
                    <th className="py-4 px-6">Handler Type</th>
                    <th className="py-4 px-6">Lifecycle Status</th>
                    <th className="py-4 px-6">Priority</th>
                    <th className="py-4 px-6">Attempts</th>
                    <th className="py-4 px-6">Created Timestamp</th>
                    <th className="py-4 px-6 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60 text-sm">
                  {serverJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-zinc-800 dark:text-zinc-200">
                      <td className="py-4 px-6 font-mono text-xs text-orange-600 dark:text-orange-400 font-bold">
                        {job.id}
                      </td>
                      <td className="py-4 px-6 font-semibold">
                        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-mono text-zinc-700 dark:text-zinc-300">
                          {job.type}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(job.status)}`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-mono font-bold text-zinc-900 dark:text-zinc-100">{job.priority}</td>
                      <td className="py-4 px-6 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                        {job.attempts} / {job.maxAttempts}
                      </td>
                      <td className="py-4 px-6 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => inspectJob(job.id)}
                          className="p-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full transition-all border border-zinc-200 dark:border-zinc-800 shadow-sm"
                          title="Inspect Job Logs & Details"
                        >
                          <Eye className="w-4 h-4 text-orange-500" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {serverJobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        No jobs match the current status filter or search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {totalCount > 0 && (
              <div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-zinc-600 dark:text-zinc-400 font-mono">
                  Showing <strong className="text-zinc-900 dark:text-white">{startIndex + 1}</strong> to{' '}
                  <strong className="text-zinc-900 dark:text-white">{Math.min(startIndex + pageSize, totalCount)}</strong> of{' '}
                  <strong className="text-zinc-900 dark:text-white">{totalCount}</strong> Total Jobs
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-semibold transition-all shadow-sm"
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
        </>
      ) : (
        /* Recurring Cron Schedules Table */
        <div className="glass-panel rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shadow-xl flex flex-col">
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Repeat className="w-5 h-5 text-purple-500" /> Active Recurring Cron Schedules
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Automatically triggered by the scheduler engine with distributed optimistic locking
              </p>
            </div>
            <button
              onClick={fetchScheduledJobs}
              className="p-2.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"
              title="Refresh Cron Schedules"
            >
              <RefreshCw className={`w-4 h-4 ${loadingCrons ? 'animate-spin text-purple-500' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/80 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  <th className="py-4 px-6">Cron Name & Target</th>
                  <th className="py-4 px-6">Cron Expression</th>
                  <th className="py-4 px-6">Target Queue</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Next Run At</th>
                  <th className="py-4 px-6">Last Run At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800/60 text-sm">
                {scheduledJobs.map((cron) => (
                  <tr key={cron.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors text-zinc-800 dark:text-zinc-200">
                    <td className="py-4 px-6">
                      <div className="font-bold text-zinc-900 dark:text-white">{cron.name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">{cron.jobType}</div>
                    </td>
                    <td className="py-4 px-6 font-mono font-bold text-purple-600 dark:text-purple-400">
                      <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        {cron.cronExpression}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full text-xs font-mono text-zinc-700 dark:text-zinc-300">
                        ⚡ {cron.queue?.name || 'Default'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border ${
                          cron.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700'
                        }`}
                      >
                        {cron.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs text-zinc-600 dark:text-zinc-300 font-mono">
                      {cron.nextRunAt ? new Date(cron.nextRunAt).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-4 px-6 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      {cron.lastRunAt ? new Date(cron.lastRunAt).toLocaleTimeString() : 'Never'}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleToggleCron(cron)}
                        disabled={togglingCronId === cron.id}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ml-auto ${
                          cron.enabled
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        {cron.enabled ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5" /> Pause
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" /> Resume
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {scheduledJobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No recurring cron jobs created yet. Click "Trigger Test Job" and select "Recurring (Cron)" mode to schedule one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspect Job Details Drawer / Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" /> Job Execution Details
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">UUID: {selectedJob.id}</p>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500">Status:</span>{' '}
                  <span className={`ml-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(selectedJob.status)}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-500">Attempts:</span>{' '}
                  <span className="text-zinc-900 dark:text-white font-bold ml-2">{selectedJob.attempts} / {selectedJob.maxAttempts}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">Payload Data</h4>
                <pre className="p-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-orange-600 dark:text-orange-400 overflow-x-auto">
                  {JSON.stringify(selectedJob.payload, null, 2)}
                </pre>
              </div>

              {selectedJob.logs && selectedJob.logs.length > 0 && (
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">Execution Logs</h4>
                  <div className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-800 text-xs font-mono space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedJob.logs.map((l, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="text-zinc-500 text-[10px]">{new Date(l.timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold ${l.level === 'ERROR' ? 'text-rose-400' : 'text-emerald-400'}`}>[{l.level}]</span>
                        <span className="text-zinc-300">{l.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <button
                onClick={() => setSelectedJob(null)}
                className="px-5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-full transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

