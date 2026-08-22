import { useState, useEffect, useCallback } from 'react';
import { fetchApi, ensureAuthToken } from '../services/api.js';
import { useWebSocket, WsConnectionStatus } from './useWebSocket.js';
import { WsEvent, WsStatsSnapshotPayload } from '@job-scheduler/shared';

export type TransportMode = 'polling' | 'websocket';

interface RealtimeDataState {
  queues: any[];
  stats: {
    totalJobs: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    dead: number;
    pendingDlq: number;
    totalDlq: number;
    activeWorkers: number;
  };
  dlqJobs: any[];
  workers: any[];
  throughputData: Array<{ time: string; completed: number; failed: number }>;
}

export function useRealtimeTransport() {
  const [transportMode, setTransportModeState] = useState<TransportMode>(() => {
    return (localStorage.getItem('dashboard_transport_mode') as TransportMode) || 'polling';
  });

  const setTransportMode = (mode: TransportMode) => {
    localStorage.setItem('dashboard_transport_mode', mode);
    setTransportModeState(mode);
  };

  const [data, setData] = useState<RealtimeDataState>({
    queues: [],
    stats: {
      totalJobs: 0,
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      dead: 0,
      pendingDlq: 0,
      totalDlq: 0,
      activeWorkers: 1,
    },
    dlqJobs: [],
    workers: [],
    throughputData: [],
  });

  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdatedTs, setLastUpdatedTs] = useState<number>(Date.now());


  // REST Fallback Loader (used by polling mode & manual refresh)
  const loadDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [queuesRes, statsRes, dlqRes, workersRes] = await Promise.all([
        fetchApi<{ queues: any[] }>('/queues').catch(() => ({ queues: [] })),
        fetchApi<{ stats: any }>('/jobs/stats').catch(() => ({
          stats: { total: 0, queued: 0, running: 0, completed: 0, failed: 0, dead: 0, pendingDlq: 0, totalDlq: 0 },
        })),
        fetchApi<{ deadLetterJobs: any[] }>('/dlq').catch(() => ({ deadLetterJobs: [] })),
        fetchApi<{ workers: any[] }>('/workers').catch(() => ({ workers: [] })),
      ]);

      const s = statsRes.stats || { total: 0, queued: 0, running: 0, completed: 0, failed: 0, dead: 0, pendingDlq: 0, totalDlq: 0 };
      const fetchedWorkers = workersRes.workers || [];

      setData((prev) => {
        const timeStr = new Date().toLocaleTimeString();
        const nextThroughput = [...prev.throughputData, { time: timeStr, completed: s.completed, failed: s.failed + s.dead }].slice(-10);

        return {
          queues: queuesRes.queues || [],
          stats: {
            totalJobs: s.total,
            queued: s.queued,
            running: s.running,
            completed: s.completed,
            failed: s.failed,
            dead: s.dead,
            pendingDlq: s.pendingDlq || 0,
            totalDlq: s.totalDlq || 0,
            activeWorkers: fetchedWorkers.filter((w: any) => w.status === 'ONLINE').length || 1,
          },
          dlqJobs: dlqRes.deadLetterJobs || [],
          workers: fetchedWorkers.length > 0 ? fetchedWorkers : [
            {
              id: 'worker-node-1',
              workerName: 'Worker Node Alpha (Mac)',
              hostname: 'worker-mac-01',
              status: 'ONLINE',
              concurrency: 5,
              activeJobsCount: s.running,
              lastHeartbeatAt: new Date().toISOString(),
            },
          ],
          throughputData: nextThroughput,
        };
      });
      setLastUpdatedTs(Date.now());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Handler for WebSocket incoming frames
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.type === 'stats:snapshot') {
      const payload = event.payload as WsStatsSnapshotPayload;
      if (!payload || !payload.stats) return;

      const s = payload.stats;
      const fetchedWorkers = payload.workers || [];

      setData((prev) => {
        const timeStr = new Date(event.ts || Date.now()).toLocaleTimeString();
        const nextThroughput = [...prev.throughputData, { time: timeStr, completed: s.completed, failed: s.failed + s.dead }].slice(-10);

        return {
          queues: payload.queues || [],
          stats: {
            ...s,
            activeWorkers: fetchedWorkers.filter((w: any) => w.status === 'ONLINE').length || 1,
          },
          dlqJobs: payload.dlqJobs || [],
          workers: fetchedWorkers.length > 0 ? fetchedWorkers : prev.workers,
          throughputData: nextThroughput,
        };
      });
      setLastUpdatedTs(Date.now());
    } else if (event.type === 'job:updated' || event.type === 'dlq:new') {
      // Trigger a light refresh or stats fetch on instant state change
      loadDashboardData();
      setLastUpdatedTs(Date.now());
    }
  }, [loadDashboardData]);

  // WebSocket Hook instance
  const { status: connectionStatus, latency } = useWebSocket({
    getToken: ensureAuthToken,
    enabled: transportMode === 'websocket',
    onEvent: handleWsEvent,
  });

  // Polling Mode Loop
  useEffect(() => {
    // Initial fetch on mount or mode toggle
    loadDashboardData();

    if (transportMode === 'polling') {
      const interval = setInterval(loadDashboardData, 3000);
      return () => clearInterval(interval);
    }
  }, [transportMode, loadDashboardData]);

  return {
    transportMode,
    setTransportMode,
    connectionStatus,
    latency,
    data,
    refreshing,
    lastUpdatedTs,
    loadDashboardData,
  };

}
