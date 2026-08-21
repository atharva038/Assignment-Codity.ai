import React from 'react';
import { Cpu, Server, Activity, ShieldCheck, Zap } from 'lucide-react';

interface WorkerNode {
  id: string;
  workerName: string;
  hostname: string;
  status: 'ONLINE' | 'OFFLINE' | 'DRAINING';
  concurrency: number;
  activeJobsCount: number;
  lastHeartbeatAt: string;
}

interface WorkersViewProps {
  workers: WorkerNode[];
}

export const WorkersView: React.FC<WorkersViewProps> = ({ workers }) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-indigo-400" /> Worker Fleet & Cluster Telemetry
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Live telemetry monitoring of active worker nodes, concurrent thread capacities, heartbeats, and cluster load balancing.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <span className="px-4 py-2 bg-indigo-950/50 border border-indigo-900/60 rounded-xl text-xs text-indigo-300 font-mono font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Total Cluster Nodes: {workers.length}
          </span>
        </div>
      </div>

      {/* Worker Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workers.map((worker) => (
          <div key={worker.id} className="glass-panel p-6 rounded-2xl border border-slate-800/80 hover:border-indigo-500/30 transition-all shadow-xl space-y-4 relative group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className={`p-3 rounded-2xl border ${
                  worker.status === 'ONLINE' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-slate-800 text-slate-500 border-slate-700'
                }`}>
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-white text-base tracking-tight">{worker.workerName}</h4>
                  <span className="text-xs font-mono text-slate-500">{worker.hostname}</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                worker.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${worker.status === 'ONLINE' ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
                {worker.status}
              </span>
            </div>

            {/* Load Capacity Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Thread Capacity Load</span>
                <span className="text-amber-400 font-bold">{worker.activeJobsCount} / {worker.concurrency} Active</span>
              </div>
              <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (worker.activeJobsCount / (worker.concurrency || 1)) * 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Claim Strategy</span>
                <span className="text-xs font-bold text-slate-200 font-mono">SKIP LOCKED</span>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Worker Threads</span>
                <span className="text-xs font-bold text-indigo-400 font-mono">{worker.concurrency} Threads</span>
              </div>
            </div>

            <div className="pt-3 text-xs text-slate-400 flex items-center justify-between border-t border-slate-800/60">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Activity className="w-3.5 h-3.5 text-emerald-400" /> Heartbeat
              </span>
              <span className="font-mono text-slate-300">{new Date(worker.lastHeartbeatAt).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}

        {workers.length === 0 && (
          <div className="col-span-full glass-panel p-12 text-center text-slate-500 rounded-2xl">
            <Server className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            No active worker nodes detected. Run <code className="bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono">npm run dev:worker</code> to join a node to the fleet!
          </div>
        )}
      </div>
    </div>
  );
};
