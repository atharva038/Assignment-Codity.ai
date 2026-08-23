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
  PanelLeftClose,
  PanelLeftOpen,
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
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isDark: boolean;
  queuesCount: number;
  jobsCount: number;
  activeWorkersCount: number;
  pendingDlqCount: number;
  onOpenDemoLab: () => void;
  onStartTour?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sidebarOpen,
  onCloseSidebar,
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  isDark,
  queuesCount,
  jobsCount,
  activeWorkersCount,
  pendingDlqCount,
  onOpenDemoLab,
  onStartTour,
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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'} ${
          isDark
            ? 'bg-zinc-950/95 border-zinc-800/80 backdrop-blur-md'
            : 'bg-[#FDFBF7] border-[#E7E2D9] backdrop-blur-md'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div
          className={`h-16 border-b flex items-center shrink-0 overflow-hidden ${
            isCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          } ${isDark ? 'border-zinc-800/80' : 'border-[#E7E2D9]'}`}
        >
          {isCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-500 shadow-md shadow-orange-500/25 text-white font-extrabold text-xs flex items-center justify-center tracking-wider hover:scale-105 transition-all cursor-pointer group"
              title="Click to Expand Sidebar"
            >
              <span className="group-hover:hidden">JS</span>
              <PanelLeftOpen className="w-5 h-5 hidden group-hover:block" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-600 to-orange-500 shadow-md shadow-orange-500/25 text-white font-extrabold text-xs flex items-center justify-center tracking-wider shrink-0">
                  JS
                </div>
                <div className="overflow-hidden">
                  <h1 className="text-xs font-extrabold tracking-tight leading-tight truncate text-zinc-100">
                    Distributed Scheduler
                  </h1>
                  <p className={`text-[10px] truncate ${isDark ? 'text-zinc-400' : 'text-stone-500'}`}>
                    Production Task Fleet
                  </p>
                </div>
              </div>

              {/* Desktop Collapse Button */}
              <button
                type="button"
                onClick={onToggleCollapse}
                className={`hidden lg:flex p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    : 'bg-stone-100 border-stone-300 text-stone-600 hover:text-stone-900'
                }`}
                title="Collapse Sidebar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={onCloseSidebar}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Navigation Tabs */}
        <nav className={`flex-1 overflow-x-hidden ${isCollapsed ? 'px-2 py-3 space-y-2' : 'px-3 py-3 space-y-1'} overflow-y-auto no-scrollbar`}>
          {!isCollapsed && (
            <div
              className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider font-mono ${
                isDark ? 'text-zinc-500' : 'text-stone-400'
              }`}
            >
              Platform Navigation
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseSidebar();
                }}
                title={isCollapsed ? `${item.label} ${item.count !== undefined ? `(${item.count})` : ''}` : undefined}
                className={`transition-all relative cursor-pointer shrink-0 ${
                  isCollapsed
                    ? 'w-10 h-10 mx-auto rounded-xl flex items-center justify-center'
                    : 'w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between'
                } ${
                  isActive
                    ? isDark
                      ? 'bg-zinc-800/90 text-white border border-zinc-700/80 shadow-sm'
                      : 'bg-stone-200 text-stone-900 border border-stone-300 shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 border border-transparent'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive
                        ? 'text-orange-400'
                        : isDark
                        ? 'text-zinc-400'
                        : 'text-stone-500'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {/* Expanded Count Badge */}
                {!isCollapsed && item.count !== undefined && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                      isActive
                        ? isDark ? 'bg-zinc-700 text-zinc-100' : 'bg-stone-300 text-stone-900'
                        : isDark
                        ? 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
                {!isCollapsed && item.count === undefined && item.badgeColor && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold shrink-0 ${
                      isActive ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : item.badgeColor
                    }`}
                  >
                    {(item as any).badge || 'Active'}
                  </span>
                )}

                {/* Collapsed Pip Badge */}
                {isCollapsed && item.count !== undefined && item.count > 0 && !isActive && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-zinc-950" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Demo Lab & Guided Product Tour Actions */}
        <div className={`px-2.5 pb-2 overflow-hidden shrink-0 ${isCollapsed ? 'space-y-2' : 'space-y-2'}`}>
          {/* Demo Lab Button */}
          <button
            id="sidebar-demo-lab"
            onClick={() => {
              onOpenDemoLab();
              onCloseSidebar();
            }}
            title={isCollapsed ? 'Demo Lab (6 Live Scenarios)' : undefined}
            className={`${
              isCollapsed
                ? 'w-10 h-10 mx-auto rounded-2xl flex items-center justify-center'
                : 'w-full px-3.5 py-2.5 rounded-2xl flex items-center justify-between'
            } bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-lg shadow-orange-500/25 transition-all relative active:scale-95 cursor-pointer shrink-0`}
          >
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 fill-current text-black shrink-0" />
              {!isCollapsed && <span>Demo Lab</span>}
            </div>
            {!isCollapsed && (
              <span className="px-1.5 py-0.5 rounded bg-black/20 text-black text-[9px] font-mono font-extrabold uppercase">
                6 Scenarios
              </span>
            )}
          </button>

          {/* Guided Tour Trigger Button */}
          {onStartTour && (
            <button
              onClick={() => {
                onStartTour();
                onCloseSidebar();
              }}
              title={isCollapsed ? 'Start Guided Product Tour' : undefined}
              className={`${
                isCollapsed
                  ? 'w-10 h-10 mx-auto rounded-xl flex items-center justify-center'
                  : 'w-full px-3 py-2 rounded-xl flex items-center justify-center gap-1.5'
              } text-xs font-bold transition-all border cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-zinc-900/90 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                  : 'bg-stone-100 border-stone-300 text-stone-700 hover:text-stone-900 hover:bg-stone-200'
              }`}
            >
              <span>🧭</span>
              {!isCollapsed && <span>Product Tour</span>}
            </button>
          )}
        </div>

        {/* User Profile & RBAC Card at Bottom of Sidebar */}
        <div
          className={`p-2.5 border-t shrink-0 relative z-40 ${
            isDark ? 'border-zinc-800/80 bg-zinc-950/80' : 'border-[#E7E2D9] bg-[#FDFBF7]'
          }`}
        >
          <UserMenu variant="sidebar" isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
};
