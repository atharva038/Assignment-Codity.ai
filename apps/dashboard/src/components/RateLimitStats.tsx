import React from 'react';
import { ShieldCheck, Gauge, Zap, Lock, RefreshCw } from 'lucide-react';

export const RateLimitStats: React.FC = () => {
  return (
    <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl bg-slate-900/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" /> API Rate Limiting & Execution Throttling
          </h4>
          <p className="text-xs text-slate-400">Sliding Window Protection & Queue Rate Control (Redis / Fallback)</p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-1 text-[11px] font-semibold rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Sliding Window Active
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="font-semibold flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-blue-400" /> Global API Limit</span>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-mono">120/min</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-slate-400 text-[11px]">Key Scope:</span>
            <span className="text-slate-200 font-mono font-medium">User ID / IP</span>
          </div>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="font-semibold flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-rose-400" /> Strict Auth Guard</span>
            <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded font-mono">10/min</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-slate-400 text-[11px]">Key Scope:</span>
            <span className="text-slate-200 font-mono font-medium">IP Address</span>
          </div>
        </div>

        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="font-semibold flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-400" /> Job Ingestion Limit</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono">60/min</span>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-slate-400 text-[11px]">Key Scope:</span>
            <span className="text-slate-200 font-mono font-medium">Tenant / Project</span>
          </div>
        </div>
      </div>
    </div>
  );
};
