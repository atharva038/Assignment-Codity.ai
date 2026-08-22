import React from 'react';
import { Zap, RefreshCw, Radio } from 'lucide-react';
import { TransportMode } from '../hooks/useRealtimeTransport.js';
import { WsConnectionStatus } from '../hooks/useWebSocket.js';

interface TransportToggleProps {
  mode: TransportMode;
  onToggle: (newMode: TransportMode) => void;
  status: WsConnectionStatus;
  latency?: number;
}

export const TransportToggle: React.FC<TransportToggleProps> = ({
  mode,
  onToggle,
  status,
  latency,
}) => {
  const isWs = mode === 'websocket';

  const handleToggle = () => {
    onToggle(isWs ? 'polling' : 'websocket');
  };

  return (
    <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 rounded-full shadow-sm">
      {/* Mode Switch Button */}
      <button
        onClick={handleToggle}
        className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
          isWs
            ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:text-zinc-900 dark:hover:text-white'
        }`}
        title={isWs ? 'Switch to HTTP Polling Mode (3s)' : 'Switch to Real-Time WebSocket Push'}
      >
        {isWs ? (
          <>
            <Zap className="w-3.5 h-3.5 fill-current animate-pulse text-emerald-200" />
            <span>WebSocket Live</span>
          </>
        ) : (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
            <span>HTTP Polling</span>
          </>
        )}
      </button>

      {/* Live Connection Indicator Badge */}
      <div className="px-2.5 py-1 text-[11px] font-mono flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-800">
        {isWs ? (
          status === 'CONNECTED' ? (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold" title={`WebSocket Connected (${latency || 0}ms)`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>LIVE</span>
              {latency !== undefined && latency > 0 && (
                <span className="text-[10px] text-zinc-400 font-normal">({latency}ms)</span>
              )}
            </span>
          ) : status === 'CONNECTING' || status === 'RECONNECTING' ? (
            <span className="flex items-center gap-1 text-amber-500 font-semibold" title="Connecting WebSocket...">
              <Radio className="w-3 h-3 animate-spin text-amber-500" />
              <span>CONNECTING...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-500 font-semibold" title="WebSocket Disconnected">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span>
              <span>OFFLINE</span>
            </span>
          )
        ) : (
          <span className="flex items-center gap-1 text-zinc-500" title="Polling REST endpoints every 3 seconds">
            <span className="h-2 w-2 rounded-full bg-orange-500"></span>
            <span>3s Cycle</span>
          </span>
        )}
      </div>
    </div>
  );
};
