import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Layers,
  ListFilter,
  Cpu,
  AlertOctagon,
  Plus,
  RefreshCw,
  GitMerge,
  Sun,
  Moon,
  Split,
  Zap,
  Menu,
  X,
  ChevronRight,
  Users,
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
import { useAuth } from './hooks/useAuth.js';

type TabType = 'overview' | 'queues' | 'jobs' | 'workflows' | 'events' | 'sharding' | 'workers' | 'dlq' | 'users';
type ThemeMode = 'dark' | 'light';

export function App() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('dashboard_theme') as ThemeMode) || 'dark';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const navItems = [
    { id: 'overview', label: 'Overview & Metrics', icon: LayoutDashboard },
    { id: 'queues', label: 'Queues & Controls', icon: Layers, count: queues.length },
    { id: 'jobs', label: 'Job Explorer', icon: ListFilter, count: stats.totalJobs },
    { id: 'workflows', label: 'Workflows & DAGs', icon: GitMerge, badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' },
    { id: 'events', label: 'Events & Webhooks', icon: Zap, badgeColor: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
    { id: 'sharding', label: 'Queue Sharding', icon: Split, badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    { id: 'workers', label: 'Worker Fleet', icon: Cpu, count: stats.activeWorkers },
    { id: 'dlq', label: 'Dead Letter Queue', icon: AlertOctagon, count: stats.pendingDlq, badgeColor: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
    { id: 'users', label: 'Users & RBAC', icon: Users, badge: 'ADMIN', badgeColor: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-black text-zinc-100' : 'light bg-[#FDFBF7] text-stone-900'} flex antialiased selection:bg-orange-500 selection:text-white transition-colors duration-200`}>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR — LOGO, NAVIGATION TABS & USER MENU FOOTER */}
      {/* ========================================================================= */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col border-r transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${
          isDark
            ? 'bg-zinc-950/95 border-zinc-800/80 backdrop-blur-md'
            : 'bg-[#FDFBF7] border-[#E7E2D9] backdrop-blur-md'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${isDark ? 'border-zinc-800/80' : 'border-[#E7E2D9]'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-500 shadow-md shadow-orange-500/25 text-white font-extrabold text-xs flex items-center justify-center tracking-wider shrink-0">
              JS
            </div>
            <div>
              <h1 className="text-xs font-extrabold tracking-tight flex items-center gap-1.5 leading-tight">
                Distributed Scheduler
                <span className="px-1.5 py-0.2 rounded text-[8px] uppercase font-mono font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  v1.0
                </span>
              </h1>
              <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>Production Task Fleet</p>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto no-scrollbar">
          <div className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider font-mono ${isDark ? 'text-zinc-500' : 'text-stone-400'}`}>
            Platform Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all group ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : isDark ? 'text-zinc-400 group-hover:text-zinc-200' : 'text-stone-500 group-hover:text-stone-800'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : isDark
                        ? 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {item.count === undefined && item.badgeColor && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor
                    }`}
                  >
                    {(item as any).badge || 'Active'}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile & RBAC Card at Bottom of Sidebar */}
        <div className={`p-3 border-t ${isDark ? 'border-zinc-800/80 bg-zinc-950/80' : 'border-[#E7E2D9] bg-[#FDFBF7]'}`}>
          <UserMenu variant="sidebar" />
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA WITH FULL TOP CONTROLS NAVBAR */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">
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
                {navItems.find((n) => n.id === activeTab)?.label || 'Overview'}
              </h2>
            </div>
          </div>

          {/* Right: Controls (Transport Toggle, Theme, Trigger Job, Refresh) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
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

            {/* Trigger Test Job Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-bold rounded-full shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
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
          {activeTab === 'jobs' && <JobsView jobs={[]} onRefresh={loadDashboardData} lastUpdatedTs={lastUpdatedTs} />}
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
    </div>
  );
}
