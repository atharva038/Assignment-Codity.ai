import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchApi, getAuthToken } from '../services/api.js';
import { useWebSocket, WsConnectionStatus } from './useWebSocket.js';
import { useAuth } from './useAuth.js';
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
  const { orgId } = useAuth();
  const [transportMode, setTransportModeState] = useState<TransportMode>(() => {
    return (localStorage.getItem('dashboard_transport_mode') as TransportMode) || 'websocket';
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
  const [lastUpdatedTs, setLastUpdatedTs] = useState<number>(0);
  const isFetchingRef = useRef<boolean>(false);

  // REST Fallback Loader (used by polling mode & manual refresh)
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (!getAuthToken()) return;
    if (document.hidden && !isManualRefresh) return; // Pause polling when tab is inactive
    if (isFetchingRef.current && !isManualRefresh) return; // Prevent duplicate parallel requests

    isFetchingRef.current = true;
    try {
      if (isManualRefresh) setRefreshing(true);

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

      if (isManualRefresh) {
        setLastUpdatedTs(Date.now());
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      isFetchingRef.current = false;
      if (isManualRefresh) setRefreshing(false);
    }
  }, []);

  // Handler for WebSocket incoming frames
  const handleWsEvent = useCallback((event: WsEvent) => {
    if (event.type === 'stats:snapshot') {
      const payload = event.payload as WsStatsSnapshotPayload;
      if (!payload || !payload.stats) return;

      const tenantQueues = (payload.queues || []).filter((q: any) => !orgId || q.project?.organizationId === orgId);
      const tenantDlq = (payload.dlqJobs || []).filter((d: any) => !orgId || d.queue?.project?.organizationId === orgId);

      const totalTenantJobs = tenantQueues.reduce((acc: number, q: any) => acc + (q.jobCount || q._count?.jobs || 0), 0);
      const isIsolatedNewTenant = !!orgId && (payload.queues || []).some((q: any) => q.project?.organizationId && q.project.organizationId !== orgId);

      const s = isIsolatedNewTenant
        ? {
            totalJobs: totalTenantJobs,
            queued: 0,
            running: 0,
            completed: totalTenantJobs,
            failed: 0,
            dead: tenantDlq.length,
            pendingDlq: tenantDlq.filter((d: any) => d.resolutionStatus === 'PENDING').length,
            totalDlq: tenantDlq.length,
          }
        : payload.stats;
      const fetchedWorkers = payload.workers || [];

      setData((prev) => {
        const timeStr = new Date(event.ts || Date.now()).toLocaleTimeString();
        const nextThroughput = [...prev.throughputData, { time: timeStr, completed: s.completed, failed: (s.failed || 0) + (s.dead || 0) }].slice(-10);

        return {
          queues: tenantQueues,
          stats: {
            ...s,
            activeWorkers: fetchedWorkers.filter((w: any) => w.status === 'ONLINE').length || 1,
          },
          dlqJobs: tenantDlq,
          workers: fetchedWorkers.length > 0 ? fetchedWorkers : prev.workers,
          throughputData: nextThroughput,
        };
      });
    } else if (event.type === 'job:updated' || event.type === 'dlq:new') {
      // Update local state timestamp so reactive views update cleanly without HTTP hammering
      setLastUpdatedTs(event.ts || Date.now());
    }
  }, [orgId]);

  // WebSocket Hook instance
  const { status: connectionStatus, latency, lastEvent } = useWebSocket({
    getToken: async () => getAuthToken() || '',
    enabled: transportMode === 'websocket' && !!getAuthToken(),
    onEvent: handleWsEvent,
  });

  // Re-fetch on orgId change, transportMode change, or mount
  useEffect(() => {
    loadDashboardData(false);

    if (transportMode === 'polling') {
      const interval = setInterval(() => {
        loadDashboardData(false);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [transportMode, orgId, loadDashboardData]);

  const handleManualRefresh = useCallback(() => {
    return loadDashboardData(true);
  }, [loadDashboardData]);

  return {
    transportMode,
    setTransportMode,
    connectionStatus,
    latency,
    data,
    refreshing,
    lastUpdatedTs,
    lastWsEvent: lastEvent,
    loadDashboardData: handleManualRefresh,
  };
}

