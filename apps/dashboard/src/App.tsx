import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Layers, ListFilter, Cpu, AlertOctagon, Plus, RefreshCw } from 'lucide-react';
import { fetchApi } from './services/api.js';
import { Overview } from './components/Overview.js';
import { QueuesView } from './components/QueuesView.js';
import { JobsView } from './components/JobsView.js';
import { WorkersView } from './components/WorkersView.js';
import { DlqView } from './components/DlqView.js';
import { CreateJobModal } from './components/CreateJobModal.js';

export function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'queues' | 'jobs' | 'workers' | 'dlq'>('overview');
  const [queues, setQueues] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalJobs: 0,
    queued: 0,
    running: 0,
    completed: 0,
    failed: 0,
    dead: 0,
    pendingDlq: 0,
    totalDlq: 0,
    activeWorkers: 1,
  });
  const [workers, setWorkers] = useState<any[]>([]);
  const [dlqJobs, setDlqJobs] = useState<any[]>([]);
  const [throughputData, setThroughputData] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);

      const [queuesRes, statsRes, dlqRes, workersRes] = await Promise.all([
        fetchApi<{ queues: any[] }>('/queues').catch(() => ({ queues: [] })),
        fetchApi<{ stats: any }>('/jobs/stats').catch(() => ({
          stats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0, dead: 0, pendingDlq: 0, totalDlq: 0 },
        })),
        fetchApi<{ deadLetterJobs: any[] }>('/dlq').catch(() => ({ deadLetterJobs: [] })),
        fetchApi<{ workers: any[] }>('/workers').catch(() => ({ workers: [] })),
      ]);

      const s = statsRes.stats || { total: 0, queued: 0, running: 0, completed: 0, failed: 0, dead: 0, pendingDlq: 0, totalDlq: 0 };
      const fetchedWorkers = workersRes.workers || [];
      setQueues(queuesRes.queues || []);
      setStats({
        totalJobs: s.total,
        queued: s.queued,
        running: s.running,
        completed: s.completed,
        failed: s.failed,
        dead: s.dead,
        pendingDlq: s.pendingDlq || 0,
        totalDlq: s.totalDlq || 0,
        activeWorkers: fetchedWorkers.filter((w: any) => w.status === 'ONLINE').length || 1,
      });
      setDlqJobs(dlqRes.deadLetterJobs || []);

      if (fetchedWorkers.length > 0) {
        setWorkers(fetchedWorkers);
      } else {
        setWorkers([
          {
            id: 'worker-node-1',
            workerName: 'Worker Node Alpha (Mac)',
            hostname: 'worker-mac-01',
            status: 'ONLINE',
            concurrency: 5,
            activeJobsCount: s.running,
            lastHeartbeatAt: new Date().toISOString(),
          },
        ]);
      }

      const timeStr = new Date().toLocaleTimeString();
      setThroughputData((prev) => {
        const next = [...prev, { time: timeStr, completed: s.completed, failed: s.failed + s.dead }];
        return next.slice(-10);
      });
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col antialiased selection:bg-brand-500 selection:text-white">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl shadow-lg shadow-brand-500/20 text-white font-extrabold text-base sm:text-lg tracking-wider">
              JS
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                Distributed Job Scheduler
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  v1.0
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400">Production Engine & Execution Fleet</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-500/25 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Trigger Test Job
            </button>
            <button
              onClick={loadDashboardData}
              className="p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors shadow-sm"
              title="Manual Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Horizontal Scrollable Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1.5 sm:gap-2 border-t border-slate-800/60 pt-2 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap">
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
            { id: 'queues', label: 'Queues & Controls', icon: Layers, count: queues.length },
            { id: 'jobs', label: 'Job Explorer', icon: ListFilter, count: stats.totalJobs },
            { id: 'workers', label: 'Worker Fleet', icon: Cpu, count: stats.activeWorkers },
            { id: 'dlq', label: 'Dead Letter Queue', icon: AlertOctagon, count: stats.pendingDlq, badgeColor: 'bg-rose-500/20 text-rose-400' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 sm:px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all flex-shrink-0 ${
                  isActive
                    ? 'border-brand-500 text-white bg-slate-900/80 shadow-sm'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                {typeof Icon === 'function' && <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${tab.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Container — Responsive Padding */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 flex-1 w-full">
        {activeTab === 'overview' && <Overview stats={stats} throughputData={throughputData} />}
        {activeTab === 'queues' && <QueuesView queues={queues} onRefresh={loadDashboardData} />}
        {activeTab === 'jobs' && <JobsView jobs={[]} onRefresh={loadDashboardData} />}
        {activeTab === 'workers' && <WorkersView workers={workers} />}
        {activeTab === 'dlq' && <DlqView dlqJobs={dlqJobs} onRefresh={loadDashboardData} />}
      </main>

      {/* Test Job Modal */}
      {isModalOpen && (
        <CreateJobModal
          queues={queues}
          onClose={() => setIsModalOpen(false)}
          onSuccess={loadDashboardData}
        />
      )}
    </div>
  );
}
