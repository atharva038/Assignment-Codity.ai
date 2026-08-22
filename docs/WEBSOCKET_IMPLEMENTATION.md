# WebSocket Real-Time Transport & Dual-Mode Toggle — Implementation Guide

This document details the design, architecture, implementation, and testing instructions for the real-time WebSocket transport layer in the **Distributed Job Scheduler**, featuring an interactive runtime toggle between **HTTP REST Polling (3s)** and **WebSocket Live Push (2s)**.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  Dashboard (React + Vite)                                              │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  useRealtimeTransport hook                                       │  │
│  │  ┌─────────────────┐          ┌────────────────────────────────┐ │  │
│  │  │  Polling Mode   │  Toggle  │      WebSocket Mode            │ │  │
│  │  │  setInterval    │ ◄──────► │  useWebSocket hook             │ │  │
│  │  │  (3s REST)      │          │  ws://localhost:3000/ws        │ │  │
│  │  └─────────────────┘          └────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
             │                                   ▲
             │ HTTP REST                         │ WS Events (JSON)
             ▼                                   │
┌────────────────────────────────────────────────────────────────────────┐
│  API Server (Express + ws library)                                     │
│                                                                        │
│  ┌──────────────────┐      ┌───────────────────────────────────────┐   │
│  │  HTTP Routes     │      │  WebSocket Server (WsManager)         │   │
│  │  (existing)      │      │  ┌─────────────────────────────────┐  │   │
│  │                  │      │  │  • JWT Auth Verification        │  │   │
│  │                  │      │  │  • Direct in-memory broadcast    │  │   │
│  │                  │      │  │  • Redis Pub/Sub fallback       │  │   │
│  │                  │      │  └─────────────────────────────────┘  │   │
│  └──────────────────┘      └───────────────────────────────────────┘   │
│                                          ▲                             │
└──────────────────────────────────────────│─────────────────────────────┘
                                           │ PUBLISH events
┌──────────────────────────────────────────┴─────────────────────────────┐
│  Worker & Scheduler Fleet                                               │
│  Publish execution updates to Redis channel `job-events`                │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shared Types & Event Envelopes

Location: `packages/shared/src/types/ws-events.ts`

```ts
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
```

---

## 3. Backend Implementation Details

### A. WebSocket Server Manager
Location: `apps/api/src/ws/WsManager.ts`
- **Authentication**: Validates Bearer JWT tokens passed in query string (`?token=...`) or `Authorization` header during HTTP `upgrade` request.
- **Client Registry**: Tracks active authenticated WebSocket clients in a `Set<AuthenticatedWebSocket>`.
- **Keepalive**: Runs a 30-second ping/pong heartbeat interval to clean up dropped client connections.
- **Pub/Sub Receiver**: Connects to Redis channel `job-events` via `ioredis` subscriber client to broadcast cross-node execution events.

### B. Periodic Stats Emitter
Location: `apps/api/src/ws/statsEmitter.ts`
- Runs a 2-second background pulse loop that queries Prisma for queues, job counts, worker fleet health, and DLQ entries.
- Broadcasts `stats:snapshot` directly in-memory via `WsManager.broadcast()` and publishes to Redis `job-events` for multi-node scaling.
- Automatically pauses database query loops when 0 WebSocket clients are connected to conserve resources.

---

## 4. Frontend Implementation Details

### A. Low-Level WebSocket Hook
Location: `apps/dashboard/src/hooks/useWebSocket.ts`
- Handles native `WebSocket` connection lifecycle.
- Uses `useRef` for event callbacks to prevent unnecessary connection tear-downs during React re-renders.
- Includes automatic exponential backoff reconnection (1s → 1.5x → 15s cap).
- Computes handshake connection latency in milliseconds.

### B. Unified Real-Time Transport Hook
Location: `apps/dashboard/src/hooks/useRealtimeTransport.ts`
- Manages `transportMode`: `'polling' | 'websocket'`.
- Persists user mode selection in `localStorage` key `dashboard_transport_mode`.
- Switches between 3-second HTTP REST polling and real-time WebSocket event dispatches without changing component interfaces.

### C. Header Transport Toggle Component
Location: `apps/dashboard/src/components/TransportToggle.tsx`
- Renders an interactive toggle button with live status indicator (`LIVE (12ms)` vs `3s Cycle`).
- Features a green pulsing LED badge for live WebSocket connections.

---

## 5. Key Bug Fixes & Resilience Optimizations

1. **Eliminated Connection Tear-Down Loop**:
   - **Problem**: `useWebSocket` originally had inline function callbacks in its `useCallback` dependency array, causing the WebSocket connection to close and reconnect on every React state change.
   - **Fix**: Stored callbacks in React `useRef` instances (`onEventRef`, `getTokenRef`), stabilizing the connection.

2. **Guaranteed Direct In-Memory Fallback**:
   - **Problem**: Stats emission previously relied solely on Redis Pub/Sub, which caused dropped frames if local Redis was absent or un-subscribed.
   - **Fix**: Added direct in-memory `wsManager.broadcast()` inside `statsEmitter.ts` alongside Redis publishing.

---

## 6. How to Test

### Automated CLI Test Suite
Run the dedicated programmatic integration test:
```bash
npm run test:ws
```
**Test Assertions**:
- `PASSED`: Connection without token rejected (`HTTP 401`).
- `PASSED`: Connection handshake established with valid JWT token.
- `PASSED`: Received `"connected"` handshake frame.
- `PASSED`: Received `"stats:snapshot"` payload frame with valid counts and lists.

### Interactive UI Testing
1. Launch the monorepo dev servers: `npm run dev:api` and `npm run dev:dashboard`.
2. Open **`http://localhost:5173`** in your browser.
3. Click **`WebSocket Live`** on the top-right header toggle.
4. Click **`Trigger Test Job`** and submit a job. Observe counts update **instantly (< 200ms)** without waiting for page refreshes or poll intervals!
