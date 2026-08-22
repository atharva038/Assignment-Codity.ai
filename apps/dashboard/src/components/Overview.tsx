import React from 'react';
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Layers, Activity, CheckCircle2, Cpu, Zap, TrendingUp, AlertOctagon } from 'lucide-react';

interface OverviewProps {
  stats: {
    totalJobs: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    dead: number;
    activeWorkers: number;
  };
  throughputData: Array<{ time: string; completed: number; failed: number }>;
  transportMode?: 'polling' | 'websocket';
}

export const Overview: React.FC<OverviewProps> = ({ stats, throughputData, transportMode = 'polling' }) => {
  const totalFinished = stats.completed + stats.failed + stats.dead;
  const successRate = totalFinished > 0 ? Math.round((stats.completed / totalFinished) * 100) : 100;

  const barData = [
    { name: 'Queued', count: stats.queued, color: '#3b82f6' },
    { name: 'Running', count: stats.running, color: '#f59e0b' },
    { name: 'Completed', count: stats.completed, color: '#10b981' },
    { name: 'Failed', count: stats.failed, color: '#f43f5e' },
    { name: 'Dead', count: stats.dead, color: '#e11d48' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Stat Cards Grid — Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Stat Card 1 */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-brand-500/30 transition-all shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Ingested Jobs</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tracking-tight">{stats.totalJobs.toLocaleString()}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-brand-500/10 text-brand-400 rounded-2xl border border-brand-500/20">
              <Layers className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 sm:pt-3">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> High Throughput Engine
            </span>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-amber-500/30 transition-all shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Active & Queued</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1 tracking-tight">{(stats.queued + stats.running).toLocaleString()}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 sm:pt-3">
            <span>Queued: <strong className="text-blue-400 font-mono">{stats.queued}</strong></span>
            <span>Running: <strong className="text-amber-400 font-mono">{stats.running}</strong></span>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-emerald-500/30 transition-all shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Success Rate</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 tracking-tight">{successRate}%</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 sm:pt-3">
            <span>Done: <strong className="text-emerald-400 font-mono">{stats.completed}</strong></span>
            <span>DLQ: <strong className="text-rose-400 font-mono">{stats.dead}</strong></span>
          </div>
        </div>

        {/* Stat Card 4 */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800/80 hover:border-indigo-500/30 transition-all shadow-xl relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">Worker Fleet</p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1 tracking-tight">{stats.activeWorkers} Node{stats.activeWorkers !== 1 ? 's' : ''}</h3>
            </div>
            <div className="p-2.5 sm:p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Cpu className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="mt-3 sm:mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60 pt-2.5 sm:pt-3">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> SKIP LOCKED
            </span>
          </div>
        </div>
      </div>

      {/* Visual Graphs — Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Throughput Area Chart */}
        <div className="lg:col-span-2 glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
            <div>
              <h4 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" /> System Throughput (Jobs/sec)
              </h4>
              <p className="text-xs text-slate-400">Real-time completed vs failed execution velocity</p>
            </div>
            <span className={`self-start sm:self-auto px-3 py-1 text-[11px] font-semibold rounded-full border ${
              transportMode === 'websocket'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-brand-500/10 text-brand-400 border-brand-500/20'
            }`}>
              {transportMode === 'websocket' ? '⚡ Live WebSocket Push (2s)' : 'Live Polling (3s)'}
            </span>
          </div>


          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="gradientFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px',
                  }}
                />
                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradientCompleted)" name="Completed" />
                <Area type="monotone" dataKey="failed" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#gradientFailed)" name="Failed / DLQ" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution Bar Chart */}
        <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-base sm:text-lg font-bold text-white">Status Breakdown</h4>
              <AlertOctagon className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-xs text-slate-400 mb-4 sm:mb-6">Distribution per job state</p>

            <div className="h-52 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.4} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
