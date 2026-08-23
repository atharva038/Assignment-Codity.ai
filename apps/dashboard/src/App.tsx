import React, { useState, useEffect } from 'react';
import {
  Plus,
  RefreshCw,
  Sun,
  Moon,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { useRealtimeTransport } from './hooks/useRealtimeTransport.js';
import { TransportToggle } from './components/TransportToggle.js';
import { UserMenu } from './components/UserMenu.js';
import { Overview } from './components/Overview.js';
import { QueuesView } from './components/QueuesView.js';
import { JobsView } from './components/JobsView.js';
import { WorkersView } from './components/WorkersView.js';
import { DlqView } from './components/DlqView.js';
import { WorkflowsView } from './components/WorkflowsView.js';
import { ShardingView } from './components/ShardingView.js';
import { EventsView } from './components/EventsView.js';
import { UsersView } from './components/UsersView.js';
import { AuthScreen } from './components/AuthScreen.js';
import { CreateJobModal } from './components/CreateJobModal.js';
import { VivaSimulationLab } from './components/VivaSimulationLab.js';
import { InteractiveTour } from './components/InteractiveTour.js';
import { Sidebar, TabType } from './components/Sidebar.js';
import { useAuth } from './hooks/useAuth.js';

type ThemeMode = 'dark' | 'light';

export function App() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('dashboard_theme') as ThemeMode) || 'dark';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isTourOpen, setIsTourOpen] = useState(false);

  const toggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const {
    loading: authLoading,
    isAuthenticated,
    login,
    register,
    switchPersona,
  } = useAuth();

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
    const validTabs: TabType[] = ['overview', 'queues', 'jobs', 'workflows', 'events', 'sharding', 'workers', 'dlq', 'users'];
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
    setSidebarOpen(false); // Close mobile drawer on navigation
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs: TabType[] = ['overview', 'queues', 'jobs', 'workflows', 'events', 'sharding', 'workers', 'dlq', 'users'];
      if (validTabs.includes(hash as TabType)) {
        setActiveTabState(hash as TabType);
        localStorage.setItem('dashboard_active_tab', hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isVivaLabOpen, setIsVivaLabOpen] = useState<boolean>(false);

  // Auto-launch product tour on initial visit
  useEffect(() => {
    if (isAuthenticated && !authLoading && !localStorage.getItem('scheduler_tour_completed')) {
      const timer = setTimeout(() => {
        setIsTourOpen(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authLoading]);

  const {
    transportMode,
    setTransportMode,
    connectionStatus,
    latency,
    data,
    refreshing,
    lastUpdatedTs,
    lastWsEvent,
    loadDashboardData,
  } = useRealtimeTransport();

  const { queues, stats, dlqJobs, workers, throughputData } = data;

  const isDark = theme === 'dark';

  if (authLoading) {
    return (
      <div className={`min-h-screen ${isDark ? 'dark bg-black text-zinc-100' : 'light bg-[#FDFBF7] text-stone-900'} flex items-center justify-center`}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-orange-500 shadow-lg shadow-orange-500/30 animate-pulse" />
          <p className="text-xs font-mono text-zinc-400">Authenticating Platform Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        onLogin={login}
        onRegister={register}
        onQuickPersona={switchPersona}
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? 'light' : 'dark')}
      />
    );
  }

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-black text-zinc-100' : 'light bg-[#FDFBF7] text-stone-900'} flex antialiased selection:bg-orange-500 selection:text-white`}>
      {/* DEDICATED SIDEBAR COMPONENT */}
      <Sidebar
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isDark={isDark}
        queuesCount={queues.length}
        jobsCount={stats.totalJobs}
        activeWorkersCount={stats.activeWorkers}
        pendingDlqCount={stats.pendingDlq}
        onOpenDemoLab={() => setIsVivaLabOpen(true)}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA WITH FULL TOP CONTROLS NAVBAR */}
      {/* ========================================================================= */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        {/* Top Controls Header */}
        <header className={`h-16 px-4 sm:px-8 border-b flex items-center justify-between sticky top-0 z-30 ${
          isDark ? 'bg-black/90 border-zinc-800/80' : 'bg-[#FDFBF7]/90 border-[#E7E2D9]'
        } backdrop-blur-md`}>
          {/* Left: Mobile hamburger & breadcrumbs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className={`p-2 rounded-xl border lg:hidden ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-stone-100 border-stone-300 text-stone-700'
              }`}
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-orange-500">
                <span>Fleet</span>
                <ChevronRight className="w-3 h-3 text-zinc-500" />
                <span className="capitalize font-bold text-zinc-300">{activeTab}</span>
              </div>
              <h2 className="text-sm font-extrabold tracking-tight capitalize leading-tight">
                {activeTab === 'overview'
                  ? 'Overview & Metrics'
                  : activeTab === 'queues'
                  ? 'Queues & Controls'
                  : activeTab === 'jobs'
                  ? 'Job Explorer'
                  : activeTab === 'workflows'
                  ? 'Workflows & DAGs'
                  : activeTab === 'events'
                  ? 'Events & Webhooks'
                  : activeTab === 'sharding'
                  ? 'Queue Sharding'
                  : activeTab === 'workers'
                  ? 'Worker Fleet'
                  : activeTab === 'dlq'
                  ? 'Dead Letter Queue'
                  : 'Users & RBAC'}
              </h2>
            </div>
          </div>

          {/* Right: Controls (Transport Toggle, Theme, Trigger Job, Refresh) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Transport Mode Toggle */}
            <div id="header-transport-toggle">
              <TransportToggle
                mode={transportMode}
                onToggle={setTransportMode}
                status={connectionStatus}
                latency={latency}
              />
            </div>

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

            {/* Trigger Test Job Button */}
            <button
              id="header-trigger-job"
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Trigger Test Job</span>
            </button>

            {/* Manual Refresh Button */}
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
        </header>

        {/* Main View Container */}
        <main className="flex-1 p-4 sm:p-8 w-full max-w-7xl mx-auto">
          {activeTab === 'overview' && <Overview stats={stats} throughputData={throughputData} transportMode={transportMode} />}
          {activeTab === 'queues' && <QueuesView queues={queues} onRefresh={loadDashboardData} />}
          {activeTab === 'jobs' && <JobsView jobs={[]} onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} lastWsEvent={lastWsEvent} />}
          {activeTab === 'workflows' && <WorkflowsView onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} />}
          {activeTab === 'events' && <EventsView queues={queues} onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} />}
          {activeTab === 'sharding' && (
            <ShardingView
              queues={queues}
              workers={workers}
              onRefresh={loadDashboardData}
              lastUpdatedTs={lastUpdatedTs}
              transportMode={transportMode}
              connectionStatus={connectionStatus}
              latency={latency}
            />
          )}
          {activeTab === 'workers' && <WorkersView workers={workers} />}
          {activeTab === 'dlq' && <DlqView dlqJobs={dlqJobs} onRefresh={loadDashboardData} />}
          {activeTab === 'users' && <UsersView />}
        </main>
      </div>

      {/* Test Job Modal */}
      {isModalOpen && (
        <CreateJobModal
          queues={queues}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            loadDashboardData();
          }}
        />
      )}

      {/* Viva Demo Lab Modal */}
      <VivaSimulationLab
        isOpen={isVivaLabOpen}
        onClose={() => setIsVivaLabOpen(false)}
        onRefreshData={loadDashboardData}
        onNavigateToTab={(tab) => {
          setActiveTab(tab as TabType);
        }}
      />

      {/* Interactive Guided Product Tour */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
        }}
        onOpenDemoLab={() => {
          setIsVivaLabOpen(true);
        }}
      />
    </div>
  );
}
