import React, { useState, useEffect } from 'react';
import { useRealtimeTransport } from './hooks/useRealtimeTransport.js';
import { useAuth } from './hooks/useAuth.js';
import { ThemeProvider, useTheme } from './context/ThemeContext.js';
import {
  Sidebar,
  Header,
  TabType,
  Overview,
  QueuesView,
  JobsView,
  WorkersView,
  DlqView,
  WorkflowsView,
  ShardingView,
  EventsView,
  UsersView,
  ArchitectureView,
  AuthScreen,
  CreateJobModal,
  SimulationLab,
  InteractiveTour,
} from './components/index.js';

function DashboardShell() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSimulationLabOpen, setIsSimulationLabOpen] = useState(false);

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

  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs: TabType[] = ['overview', 'architecture', 'queues', 'jobs', 'workflows', 'events', 'sharding', 'workers', 'dlq', 'users'];
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
    setSidebarOpen(false);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs: TabType[] = ['overview', 'architecture', 'queues', 'jobs', 'workflows', 'events', 'sharding', 'workers', 'dlq', 'users'];
      if (validTabs.includes(hash as TabType)) {
        setActiveTabState(hash as TabType);
        localStorage.setItem('dashboard_active_tab', hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] dark:bg-black text-stone-900 dark:text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-600 to-orange-500 shadow-lg shadow-orange-500/30 animate-pulse" />
          <p className="text-xs font-mono text-stone-500 dark:text-zinc-400">Authenticating Platform Session...</p>
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
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-black text-stone-900 dark:text-zinc-100 flex antialiased selection:bg-orange-500 selection:text-white">
      {/* Sidebar Navigation */}
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
        onOpenDemoLab={() => setIsSimulationLabOpen(true)}
        onStartTour={() => setIsTourOpen(true)}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        {/* Top Controls Header */}
        <Header
          activeTab={activeTab}
          onOpenSidebar={() => setSidebarOpen(true)}
          transportMode={transportMode}
          onToggleTransport={setTransportMode}
          connectionStatus={connectionStatus}
          latency={latency}
          onOpenCreateJob={() => setIsModalOpen(true)}
          onRefreshData={loadDashboardData}
          refreshing={refreshing}
        />

        {/* Active Tab View */}
        <main className="flex-1 p-4 sm:p-8 w-full max-w-7xl mx-auto">
          {activeTab === 'overview' && <Overview stats={stats} throughputData={throughputData} transportMode={transportMode} />}
          {activeTab === 'architecture' && <ArchitectureView onRefresh={loadDashboardData} />}
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

      {/* Demo Simulation Lab Modal / Drawer */}
      <SimulationLab
        isOpen={isSimulationLabOpen}
        onClose={() => setIsSimulationLabOpen(false)}
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
          setIsSimulationLabOpen(true);
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <DashboardShell />
    </ThemeProvider>
  );
}
