import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ListFilter,
  Cpu,
  AlertOctagon,
  GitMerge,
  Split,
  Zap,
  Users,
  Flame,
  X,
} from 'lucide-react';
import { UserMenu } from './UserMenu.js';

export type TabType =
  | 'overview'
  | 'queues'
  | 'jobs'
  | 'workflows'
  | 'events'
  | 'sharding'
  | 'workers'
  | 'dlq'
  | 'users';

interface SidebarProps {
  sidebarOpen: boolean;
  onCloseSidebar: () => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isDark: boolean;
  queuesCount: number;
  jobsCount: number;
  activeWorkersCount: number;
  pendingDlqCount: number;
  onOpenDemoLab: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  onCloseSidebar,
  activeTab,
  onSelectTab,
  isDark,
  queuesCount,
  jobsCount,
  activeWorkersCount,
  pendingDlqCount,
  onOpenDemoLab,
}) => {
  const navItems = [
    { id: 'overview' as TabType, label: 'Overview & Metrics', icon: LayoutDashboard },
    { id: 'queues' as TabType, label: 'Queues & Controls', icon: Layers, count: queuesCount },
    { id: 'jobs' as TabType, label: 'Job Explorer', icon: ListFilter, count: jobsCount },
    {
      id: 'workflows' as TabType,
      label: 'Workflows & DAGs',
      icon: GitMerge,
      badgeColor: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    },
    {
      id: 'events' as TabType,
      label: 'Events & Webhooks',
      icon: Zap,
      badgeColor: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    },
    {
      id: 'sharding' as TabType,
      label: 'Queue Sharding',
      icon: Split,
      badgeColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    },
    { id: 'workers' as TabType, label: 'Worker Fleet', icon: Cpu, count: activeWorkersCount },
    {
      id: 'dlq' as TabType,
      label: 'Dead Letter Queue',
      icon: AlertOctagon,
      count: pendingDlqCount,
      badgeColor: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    },
    {
      id: 'users' as TabType,
      label: 'Users & RBAC',
      icon: Users,
      badge: 'ADMIN',
      badgeColor: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={onCloseSidebar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in"
        />
      )}

      {/* Main Sidebar Container */}
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
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isDark ? 'border-zinc-800/80' : 'border-[#E7E2D9]'
          }`}
        >
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
              <p className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                Production Task Fleet
              </p>
            </div>
          </div>

          <button
            onClick={onCloseSidebar}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto no-scrollbar">
          <div
            className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider font-mono ${
              isDark ? 'text-zinc-500' : 'text-stone-400'
            }`}
          >
            Platform Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseSidebar();
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all group cursor-pointer ${
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
                      isActive
                        ? 'text-white'
                        : isDark
                        ? 'text-zinc-400 group-hover:text-zinc-200'
                        : 'text-stone-500 group-hover:text-stone-800'
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

        {/* Demo Lab Featured Sidebar Button */}
        <div className="px-3 pb-2">
          <button
            onClick={() => {
              onOpenDemoLab();
              onCloseSidebar();
            }}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs flex items-center justify-between shadow-lg shadow-orange-500/25 transition-all group active:scale-95 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 fill-current text-black" />
              <span>Demo Lab</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-black/20 text-black text-[9px] font-mono font-extrabold uppercase">
              Live
            </span>
          </button>
        </div>

        {/* User Profile & RBAC Card at Bottom of Sidebar */}
        <div
          className={`p-3 border-t ${
            isDark ? 'border-zinc-800/80 bg-zinc-950/80' : 'border-[#E7E2D9] bg-[#FDFBF7]'
          }`}
        >
          <UserMenu variant="sidebar" />
        </div>
      </aside>
    </>
  );
};
