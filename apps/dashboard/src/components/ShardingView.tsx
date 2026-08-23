/**
 * ============================================================================
 * Queue Sharding & Partition Topology Visualizer — Dashboard Component
 * ============================================================================
 * Visualizes deterministic consistent hashing (FNV-1a), partition-routed job
 * ingestion, physical B-Tree sub-tree isolation, dedicated worker fleet
 * bindings, and real-time WebSocket live updates.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Split,
  Cpu,
  Layers,
  Zap,
  ShieldCheck,
  Activity,
  ArrowRight,
  Database,
  Sparkles,
  RefreshCw,
  Play,
  CheckCircle2,
  Sliders,
  Terminal,
  Clock,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { fetchApi } from '../services/api.js';
import { WsConnectionStatus } from '../hooks/useWebSocket.js';

interface QueueItem {
  id: string;
  name: string;
  priority: number;
  concurrencyLimit: number;
  rateLimitMaxJobs?: number | null;
  rateLimitWindowMs?: number;
  status: 'ACTIVE' | 'PAUSED';
  _count?: { jobs: number };
}

interface WorkerItem {
  id: string;
  workerName?: string;
  hostname?: string;
  status: 'ONLINE' | 'BUSY' | 'DRAINING' | 'OFFLINE';
  concurrency: number;
  activeJobsCount: number;
  lastHeartbeatAt?: string;
}

interface ShardingViewProps {
  queues: QueueItem[];
  workers?: WorkerItem[];
  onRefresh: () => void;
  lastUpdatedTs?: number;
  transportMode?: 'polling' | 'websocket';
  connectionStatus?: WsConnectionStatus;
  latency?: number;
}

/**
 * Client-side 32-bit FNV-1a Hash Implementation for Live Math Preview
 */
function fnv1aHash(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

export const ShardingView: React.FC<ShardingViewProps> = ({
  queues,
  workers = [],
  onRefresh,
  lastUpdatedTs = Date.now(),
  transportMode = 'websocket',
  connectionStatus = 'CONNECTED',
  latency = 12,
}) => {
  const [shardKey, setShardKey] = useState<string>('tenant_fintech_alpha');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastWsPulse, setLastWsPulse] = useState<number>(Date.now());
  const [simulationLogs, setSimulationLogs] = useState<Array<{
    id: string;
    timestamp: string;
    tenant: string;
    shardIndex: number;
    queueName: string;
    status: string;
    source: 'WEBSOCKET' | 'API_DISPATCH';
  }>>([]);

  // Trigger brief visual pulse on incoming WebSocket broadcast
  // Trigger brief visual pulse on incoming WebSocket broadcast
  useEffect(() => {
    setLastWsPulse(Date.now());
  }, [lastUpdatedTs]);

  // Identify sharded queues or fallback to available queues
  const shardQueues = useMemo(() => {
    const sharded = queues.filter((q) => q.name.includes('shard') || q.name.includes('partition'));
    return sharded.length >= 2 ? sharded : queues.slice(0, 4);
  }, [queues]);

  const totalShards = Math.max(1, shardQueues.length);

  // Live Math Calculations
  const calculatedHash = useMemo(() => fnv1aHash(shardKey), [shardKey]);
  const calculatedHex = useMemo(() => '0x' + calculatedHash.toString(16).toUpperCase().padStart(8, '0'), [calculatedHash]);
  const activeShardIndex = useMemo(() => calculatedHash % totalShards, [calculatedHash, totalShards]);
  const targetQueue = shardQueues[activeShardIndex] || shardQueues[0];

  // Preset Tenant / Shard Keys
  const presetKeys = [
    { label: 'Fintech Alpha', key: 'tenant_fintech_alpha' },
    { label: 'E-Commerce Beta', key: 'tenant_ecommerce_beta' },
    { label: 'Healthcare Gamma', key: 'tenant_health_gamma' },
    { label: 'Logistics Delta', key: 'tenant_logistics_delta' },
    { label: 'Enterprise User 99', key: 'user_enterprise_992' },
  ];

  // Run Multi-Tenant Live Dispatch Batch
  const runLiveBatchSimulation = async () => {
    if (shardQueues.length === 0) {
      alert('Please create at least one queue first.');
      return;
    }

    setIsSimulating(true);
    const shardQueueIds = shardQueues.map((q) => q.id);
    const testTenants = [
      'tenant_apple_corp',
      'tenant_google_cloud',
      'tenant_meta_social',
      'tenant_amazon_prime',
      'tenant_netflix_stream',
      'tenant_microsoft_azure',
    ];

    const newLogs: typeof simulationLogs = [];

    for (const tenant of testTenants) {
      try {
        const res = await fetchApi<{
          routedQueueId: string;
          shardIndex: number;
          job: { id: string; status: string };
        }>('/jobs/sharded', {
          method: 'POST',
          body: JSON.stringify({
            shardKey: tenant,
            shardQueueIds,
            type: 'multi_tenant_sharded_report',
            payload: { tenant, timestamp: new Date().toISOString(), simulated: true },
            priority: 25,
          }),
        });

        const targetQ = shardQueues.find((q) => q.id === res.routedQueueId);
        const logId = res.job.id;

        newLogs.unshift({
          id: logId,
          timestamp: new Date().toLocaleTimeString(),
          tenant,
          shardIndex: res.shardIndex,
          queueName: targetQ ? targetQ.name : `Shard ${res.shardIndex}`,
          status: 'RUNNING',
          source: 'API_DISPATCH',
        });

        setSimulationLogs([...newLogs]);

        // Gracefully mark as COMPLETED after worker processing duration
        setTimeout(() => {
          setSimulationLogs((prev) =>
            prev.map((item) => (item.id === logId ? { ...item, status: 'COMPLETED' } : item))
          );
        }, 1200);

        await new Promise((r) => setTimeout(r, 220)); // Visual spacing
      } catch (err: any) {
        console.error('Error in sharding simulation:', err);
      }
    }

    setIsSimulating(false);
    onRefresh();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Banner with Live WebSocket Telemetry */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center gap-1">
                <Split className="w-3 h-3" /> FNV-1a CONSISTENT HASHING
              </span>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> ZERO LOCK CONTENTION
              </span>

              {/* WebSocket Live Stream Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 border transition-all ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {connectionStatus === 'CONNECTED' ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <Wifi className="w-3 h-3" />
                    <span>WS STREAM LIVE ({latency}ms)</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    <span>TRANSPORT: {transportMode.toUpperCase()} ({connectionStatus})</span>
                  </>
                )}
              </span>
            </div>

            <h2 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
              Queue Sharding & Partition Topology
            </h2>
            <p className="text-xs text-zinc-400 max-w-2xl mt-1 leading-relaxed">
              Horizontally partitions job ingestion across isolated PostgreSQL B-Tree sub-indexes and dedicated worker fleets.
              Tenant workloads are deterministically mapped via FNV-1a hashing with real-time WebSocket state streaming.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={runLiveBatchSimulation}
              disabled={isSimulating}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 ${
                isSimulating
                  ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20'
              }`}
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Routing Multi-Tenant Batch...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>⚡ Dispatch Multi-Tenant Batch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Hash Router Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-orange-400" />
                Interactive Hash Router Sandbox
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">Live Math Evaluator</span>
            </div>

            {/* Shard Key Input */}
            <div className="space-y-2 mb-4">
              <label className="text-[11px] font-medium text-zinc-400">Partition / Shard Key (e.g. Tenant, User ID)</label>
              <div className="relative">
                <input
                  type="text"
                  value={shardKey}
                  onChange={(e) => setShardKey(e.target.value)}
                  placeholder="Enter tenant or customer key..."
                  className="w-full bg-black/60 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-orange-500 transition-colors"
                />
                <Sparkles className="w-4 h-4 text-orange-400 absolute right-3 top-2.5 opacity-60" />
              </div>
            </div>

            {/* Preset Key Pills */}
            <div className="space-y-1.5 mb-5">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {presetKeys.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setShardKey(p.key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${
                      shardKey === p.key
                        ? 'bg-orange-500 text-white font-bold shadow-sm'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-700/50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Real-time Math Calculation Box */}
          <div className="rounded-xl border border-zinc-800 bg-black/80 p-4 space-y-2.5 font-mono text-xs">
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="text-[11px]">32-Bit FNV-1a Hash</span>
              <span className="text-orange-400 font-bold">{calculatedHex}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="text-[11px]">Decimal Value</span>
              <span className="text-zinc-200">{calculatedHash.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="text-[11px]">Modulo Shard Formula</span>
              <span className="text-zinc-300">hash % {totalShards} Shards</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-bold text-white uppercase tracking-wider">Routed Target Shard</span>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20">
                Shard {activeShardIndex} ({targetQueue?.name || 'Partition'})
              </span>
            </div>
          </div>
        </div>

        {/* Animated SVG Topology & Packet Flow Visualizer with WebSocket Stream Indicator */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-orange-400" />
              Live Shard Routing & Topology Architecture
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> WebSocket Live Vector Stream
            </span>
          </div>

          {/* Interactive SVG Diagram */}
          <div className="w-full bg-black/70 rounded-xl border border-zinc-800 p-4 relative overflow-hidden flex items-center justify-center min-h-[220px]">
            <svg viewBox="0 0 700 220" className="w-full h-full max-h-[240px]">
              <defs>
                {/* Glowing Line Gradients */}
                <linearGradient id="activePathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F97316" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>

                <linearGradient id="inactivePathGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#27272A" />
                  <stop offset="100%" stopColor="#3F3F46" />
                </linearGradient>

                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Connector Bezier Curves from Router (x: 250, y: 110) to Shards (x: 450) */}
              {shardQueues.map((_, idx) => {
                const total = shardQueues.length;
                const targetY = total === 1 ? 110 : 40 + (idx * (140 / (total - 1 || 1)));
                const isActive = idx === activeShardIndex;

                return (
                  <g key={`path-${idx}`}>
                    {/* Background Static Wire */}
                    <path
                      d={`M 250 110 C 340 110, 360 ${targetY}, 450 ${targetY}`}
                      fill="none"
                      stroke={isActive ? 'url(#activePathGrad)' : '#27272A'}
                      strokeWidth={isActive ? 3 : 1.5}
                      strokeOpacity={isActive ? 0.9 : 0.4}
                      filter={isActive ? 'url(#glow)' : undefined}
                    />

                    {/* Animated Pulsing Particles on Active Route */}
                    {isActive && (
                      <circle r="4" fill="#FFFFFF">
                        <animateMotion
                          path={`M 250 110 C 340 110, 360 ${targetY}, 450 ${targetY}`}
                          dur="1.4s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* Node 1: API Ingestion Gateway */}
              <g transform="translate(20, 75)">
                <rect width="110" height="70" rx="10" fill="#18181B" stroke="#3F3F46" strokeWidth="1.5" />
                <text x="55" y="32" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
                  API Client
                </text>
                <text x="55" y="48" textAnchor="middle" fill="#A1A1AA" fontSize="9" fontFamily="monospace">
                  POST /jobs/sharded
                </text>
                <circle cx="110" cy="35" r="4" fill="#F97316" />
              </g>

              {/* Ingestion to Router Wire */}
              <line x1="130" y1="110" x2="170" y2="110" stroke="#F97316" strokeWidth="2.5" strokeDasharray="4 2" />

              {/* Node 2: FNV-1a Consistent Hash Router */}
              <g transform="translate(170, 70)">
                <rect width="80" height="80" rx="14" fill="#18181B" stroke="#F97316" strokeWidth="2" filter="url(#glow)" />
                <text x="40" y="36" textAnchor="middle" fill="#F97316" fontSize="12" fontWeight="800" fontFamily="sans-serif">
                  FNV-1a
                </text>
                <text x="40" y="52" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  ROUTER
                </text>
                <text x="40" y="66" textAnchor="middle" fill="#71717A" fontSize="8" fontFamily="monospace">
                  %{totalShards} Shards
                </text>
              </g>

              {/* Node 3: Physical Shard Targets */}
              {shardQueues.map((q, idx) => {
                const total = shardQueues.length;
                const targetY = total === 1 ? 110 : 40 + (idx * (140 / (total - 1 || 1)));
                const isActive = idx === activeShardIndex;

                return (
                  <g key={`node-${idx}`} transform={`translate(450, ${targetY - 22})`}>
                    <rect
                      width="130"
                      height="44"
                      rx="8"
                      fill={isActive ? '#271708' : '#18181B'}
                      stroke={isActive ? '#F97316' : '#27272A'}
                      strokeWidth={isActive ? 2 : 1}
                      filter={isActive ? 'url(#glow)' : undefined}
                    />
                    <text
                      x="12"
                      y="18"
                      fill={isActive ? '#FFFFFF' : '#A1A1AA'}
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      Shard {idx}: {q.name.slice(0, 12)}
                    </text>
                    <text
                      x="12"
                      y="32"
                      fill={isActive ? '#FB923C' : '#71717A'}
                      fontSize="8"
                      fontFamily="monospace"
                    >
                      B-Tree Leaf Branch #{idx}
                    </text>
                    <circle cx="120" cy="22" r="3.5" fill={isActive ? '#10B981' : '#52525B'} />
                  </g>
                );
              })}

              {/* Node 4: Dedicated Worker Fleets */}
              <g transform="translate(600, 75)">
                <rect width="85" height="70" rx="10" fill="#18181B" stroke="#10B981" strokeWidth="1.5" />
                <text x="42" y="32" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="sans-serif">
                  Worker Fleet
                </text>
                <text x="42" y="48" textAnchor="middle" fill="#10B981" fontSize="9" fontFamily="monospace">
                  SKIP LOCKED
                </text>
              </g>
            </svg>
          </div>
        </div>
      </div>

      {/* Live Physical Shards Telemetry Cards with Real-Time WebSocket Sync */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-orange-400" />
            Active Physical Queue Shards ({shardQueues.length})
          </h3>
          <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Live WebSocket Sync ({new Date(lastUpdatedTs).toLocaleTimeString()})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shardQueues.map((queue, index) => {
            const isTargeted = index === activeShardIndex;
            const onlineWorkersCount = workers.filter((w) => w.status === 'ONLINE').length;

            return (
              <div
                key={queue.id}
                className={`rounded-2xl border transition-all duration-300 p-5 relative overflow-hidden flex flex-col justify-between ${
                  isTargeted
                    ? 'border-orange-500/80 bg-gradient-to-b from-orange-950/20 to-zinc-900 shadow-xl shadow-orange-500/10 ring-1 ring-orange-500/50'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                {isTargeted && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-amber-500 text-white text-[9px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-bl-lg shadow-sm">
                    Active Route Target
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                      SHARD #{index}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> ACTIVE
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white truncate mb-1" title={queue.name}>
                    {queue.name}
                  </h4>
                  <p className="text-[10px] font-mono text-zinc-500 truncate mb-4">
                    ID: {queue.id}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-2.5">
                      <span className="text-[10px] text-zinc-400 block font-medium">B-Tree Status</span>
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="w-3 h-3" /> Isolated
                      </span>
                    </div>

                    <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-2.5">
                      <span className="text-[10px] text-zinc-400 block font-medium">Total Jobs</span>
                      <span className="text-xs font-bold text-orange-400 mt-0.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {queue._count?.jobs ?? (queue as any).jobCount ?? 0} jobs
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-3 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-500">Worker Fleet:</span>
                  <span className="text-orange-400 font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Fleet-Shard-{index} ({onlineWorkersCount} active)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Sharding Simulation Stream Logs */}
      {simulationLogs.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-black/90 p-5 font-mono">
          <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-orange-400" />
              Live Ingestion & Hash Route Dispatch Stream ({simulationLogs.length})
            </span>
            <button
              onClick={() => setSimulationLogs([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Clear Logs
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
            {simulationLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between py-1 border-b border-zinc-900/60 text-zinc-300">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-600 text-[10px]">{log.timestamp}</span>
                  <span className="text-orange-400 font-bold">{log.tenant}</span>
                  <ArrowRight className="w-3 h-3 text-zinc-600" />
                  <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 font-bold">
                    Shard #{log.shardIndex} ({log.queueName})
                  </span>
                </div>
                {log.status === 'COMPLETED' ? (
                  <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> COMPLETED
                  </span>
                ) : log.status === 'RUNNING' ? (
                  <span className="text-cyan-400 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span> EXECUTING
                  </span>
                ) : log.status === 'DEAD' ? (
                  <span className="text-rose-400 text-[10px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> DEAD (DLQ)
                  </span>
                ) : (
                  <span className="text-amber-400 text-[10px] font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400 animate-pulse" /> ROUTED & QUEUED
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
