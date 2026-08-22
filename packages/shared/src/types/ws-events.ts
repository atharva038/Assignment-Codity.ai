/**
 * ============================================================================
 * WebSocket Event Envelopes & Event Payload Types
 * ============================================================================
 * Defines standard real-time message structures for bidirectional communication
 * between the API Server WebSocket server and Dashboard clients.
 */

export type WsEventType =
  | 'connected'
  | 'job:updated'
  | 'stats:snapshot'
  | 'worker:heartbeat'
  | 'dlq:new';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  payload: T;
  ts: number;
}

export interface WsStatsSnapshotPayload {
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
}

export interface WsJobUpdatedPayload {
  jobId: string;
  status: string;
  queueId: string;
  workerId?: string | null;
  updatedAt: string;
}
