import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Layers, ListFilter, Cpu, AlertOctagon, Plus, RefreshCw, GitMerge, Sun, Moon } from 'lucide-react';
import { useRealtimeTransport } from './hooks/useRealtimeTransport.js';
import { TransportToggle } from './components/TransportToggle.js';
import { Overview } from './components/Overview.js';
import { QueuesView } from './components/QueuesView.js';
import { JobsView } from './components/JobsView.js';
import { WorkersView } from './components/WorkersView.js';
import { DlqView } from './components/DlqView.js';
import { WorkflowsView } from './components/WorkflowsView.js';
import { CreateJobModal } from './components/CreateJobModal.js';

type TabType = 'overview' | 'queues' | 'jobs' | 'workers' | 'dlq' | 'workflows';
type ThemeMode = 'dark' | 'light';

export function App() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('dashboard_theme') as ThemeMode) || 'dark';
  });

  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem('dashboard_theme', mode);
    setThemeState(mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    setTheme(theme);
  }, []);

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs: TabType[] = ['overview', 'queues', 'jobs', 'workflows', 'workers', 'dlq'];
    if (validTabs.includes(hash as TabType)) {
      return hash as TabType;
    }
    const saved = localStorage.getItem('dashboard_active_tab');
    if (saved && validTabs.includes(saved as TabType)) {
      return saved as TabType;
    }
    return 'overview';
  });

  const setActiveTab = (tab: TabType) => {
    localStorage.setItem('dashboard_active_tab', tab);
    window.location.hash = tab;
    setActiveTabState(tab);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs: TabType[] = ['overview', 'queues', 'jobs', 'workflows', 'workers', 'dlq'];
      if (validTabs.includes(hash as TabType)) {
        setActiveTabState(hash as TabType);
        localStorage.setItem('dashboard_active_tab', hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const {
    transportMode,
    setTransportMode,
    connectionStatus,
    latency,
    data,
    refreshing,
    lastUpdatedTs,
    loadDashboardData,
  } = useRealtimeTransport();

  const { queues, stats, dlqJobs, workers, throughputData } = data;

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-black text-zinc-100' : 'light bg-[#FDFBF7] text-stone-900'} flex flex-col antialiased selection:bg-orange-500 selection:text-white transition-colors duration-200`}>
      {/* Minimalist Top Header Navigation */}
      <header className={`border-b ${isDark ? 'border-zinc-800/80 bg-black/90' : 'border-[#E7E2D9] bg-[#FDFBF7]/90'} backdrop-blur-md sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Circular Minimalist Logo */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-orange-500 shadow-md shadow-orange-500/20 text-white font-extrabold text-sm flex items-center justify-center tracking-wider shrink-0">
              JS
            </div>
            <div>
              <h1 className={`text-base font-extrabold tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-stone-900'}`}>
                Distributed Job Scheduler
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  v1.0
                </span>
              </h1>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-stone-600'}`}>Production Engine & Execution Fleet</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap sm:flex-nowrap">
            {/* Transport Mode Toggle */}
            <TransportToggle
              mode={transportMode}
              onToggle={setTransportMode}
              status={connectionStatus}
              latency={latency}
            />

            {/* Dark / Light Mode Switcher */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`p-2 rounded-full border transition-all ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-orange-400 hover:bg-zinc-800'
                  : 'bg-zinc-100 border-zinc-300 text-orange-600 hover:bg-zinc-200'
              }`}
              title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Circular Trigger Job Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Trigger Test Job
            </button>

            <button
              onClick={loadDashboardData}
              className={`p-2 rounded-full border transition-colors shadow-sm ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-zinc-900'
              }`}
              title="Manual Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Minimalist Pill Tab Navigation */}
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t ${isDark ? 'border-zinc-800/60' : 'border-zinc-200'} py-2 overflow-x-auto no-scrollbar scrollbar-none whitespace-nowrap`}>
          {[
            { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
            { id: 'queues', label: 'Queues & Controls', icon: Layers, count: queues.length },
            { id: 'jobs', label: 'Job Explorer', icon: ListFilter, count: stats.totalJobs },
            { id: 'workflows', label: 'Workflows & DAGs', icon: GitMerge, badgeColor: 'bg-orange-500/10 text-orange-500' },
            { id: 'workers', label: 'Worker Fleet', icon: Cpu, count: stats.activeWorkers },
            { id: 'dlq', label: 'Dead Letter Queue', icon: AlertOctagon, count: stats.pendingDlq, badgeColor: 'bg-rose-500/10 text-rose-500' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {typeof Icon === 'function' && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />}
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.badgeColor || (isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-200 text-zinc-700')
                  }`}>
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
        {activeTab === 'overview' && <Overview stats={stats} throughputData={throughputData} transportMode={transportMode} />}
        {activeTab === 'queues' && <QueuesView queues={queues} onRefresh={loadDashboardData} />}
        {activeTab === 'jobs' && <JobsView jobs={[]} onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} />}
        {activeTab === 'workflows' && <WorkflowsView onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} />}
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
