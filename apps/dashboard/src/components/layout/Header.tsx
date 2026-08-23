import React from 'react';
import { Menu, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { TransportToggle } from '../TransportToggle.js';
import { ThemeToggle } from './ThemeToggle.js';
import { TabType } from '../Sidebar.js';
import { TransportMode } from '../../hooks/useRealtimeTransport.js';
import { WsConnectionStatus } from '../../hooks/useWebSocket.js';

interface HeaderProps {
  activeTab: TabType;
  onOpenSidebar: () => void;
  transportMode: TransportMode;
  onToggleTransport: (mode: TransportMode) => void;
  connectionStatus: WsConnectionStatus;
  latency: number | null;
  onOpenCreateJob: () => void;
  onRefreshData: () => void;
  refreshing: boolean;
}

const TAB_TITLES: Record<TabType, string> = {
  overview: 'Overview & Metrics',
  queues: 'Queues & Controls',
  jobs: 'Job Explorer',
  workflows: 'Workflows & DAGs',
  events: 'Events & Webhooks',
  sharding: 'Queue Sharding',
  workers: 'Worker Fleet',
  dlq: 'Dead Letter Queue',
  users: 'Users & RBAC',
};

export function Header({
  activeTab,
  onOpenSidebar,
  transportMode,
  onToggleTransport,
  connectionStatus,
  latency,
  onOpenCreateJob,
  onRefreshData,
  refreshing,
}: HeaderProps) {
  return (
    <header className="h-16 px-4 sm:px-8 border-b flex items-center justify-between sticky top-0 z-30 bg-[#FDFBF7]/90 dark:bg-black/90 border-[#E7E2D9] dark:border-zinc-800/80 backdrop-blur-md">
      {/* Left: Mobile hamburger & breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-xl border lg:hidden bg-stone-100 dark:bg-zinc-900 border-stone-300 dark:border-zinc-800 text-stone-700 dark:text-zinc-300 cursor-pointer"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-orange-500">
            <span>Fleet</span>
            <ChevronRight className="w-3 h-3 text-stone-400 dark:text-zinc-500" />
            <span className="capitalize font-bold text-stone-800 dark:text-zinc-300">{activeTab}</span>
          </div>
          <h2 className="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white capitalize leading-tight">
            {TAB_TITLES[activeTab] || 'Dashboard'}
          </h2>
        </div>
      </div>

      {/* Right: Controls (Transport Toggle, Theme, Trigger Job, Refresh) */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Transport Mode Toggle */}
        <div id="header-transport-toggle">
          <TransportToggle
            mode={transportMode}
            onToggle={onToggleTransport}
            status={connectionStatus}
            latency={latency || undefined}
          />
        </div>

        {/* Dark / Light Mode Switcher */}
        <ThemeToggle />

        {/* Trigger Test Job Button */}
        <button
          id="header-trigger-job"
          onClick={onOpenCreateJob}
          className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-white dark:text-zinc-950" />
          <span className="hidden sm:inline">Trigger Test Job</span>
        </button>

        {/* Manual Refresh Button */}
        <button
          onClick={onRefreshData}
          className="p-2 rounded-xl border transition-colors shadow-sm bg-stone-100 dark:bg-zinc-900 border-stone-300 dark:border-zinc-800 text-stone-700 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-white cursor-pointer"
          title="Manual Refresh"
          aria-label="Refresh Dashboard Data"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-orange-500' : ''}`} />
        </button>
      </div>
    </header>
  );
}
