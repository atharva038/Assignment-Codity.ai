/**
 * ============================================================================
 * WebSocket Server Manager — Distributed Job Scheduler
 * ============================================================================
 * Manages WebSocket connections, authentication, keepalive pings, and real-time
 * broadcasting of job execution events received via Redis Pub/Sub.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { logger } from '@job-scheduler/logger';
import { createRedisClient, REDIS_JOB_EVENTS_CHANNEL } from '@job-scheduler/redis';
import { WsEvent } from '@job-scheduler/shared';
import { AuthenticatedUserPayload } from '../middleware/auth.js';
import { emitStatsSnapshot } from './statsEmitter.js';



const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-assignment-jwt-key-2026';

export interface AuthenticatedWebSocket extends WebSocket {
  isAlive?: boolean;
  user?: AuthenticatedUserPayload;
}

export class WsManager {
  private wss: WebSocketServer;
  private clients: Set<AuthenticatedWebSocket> = new Set();
  private pingInterval: NodeJS.Timeout | null = null;
  private subscriberRedis: ReturnType<typeof createRedisClient> | null = null;

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ noServer: true });

    // Attach HTTP upgrade handler
    server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
      
      // Only handle upgrades targeting /ws or /api/v1/ws
      if (url.pathname !== '/ws' && url.pathname !== '/api/v1/ws') {
        socket.destroy();
        return;
      }

      // Extract token from query string (?token=...) or Authorization header
      let token = url.searchParams.get('token');
      if (!token && request.headers.authorization) {
        const authHeader = request.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        logger.warn('WebSocket upgrade rejected: Missing auth token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          const authWs = ws as AuthenticatedWebSocket;
          authWs.user = decoded;
          this.wss.emit('connection', authWs, request);
        });
      } catch (err: any) {
        logger.warn({ err: err.message }, 'WebSocket upgrade rejected: Invalid JWT token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket) => {
      ws.isAlive = true;
      this.clients.add(ws);

      logger.info({ user: ws.user?.email, totalClients: this.clients.size }, 'WebSocket client connected');

      // Send initial connection confirmation frame
      const connectEvent: WsEvent<{ message: string }> = {
        type: 'connected',
        payload: { message: 'WebSocket real-time channel established successfully.' },
        ts: Date.now(),
      };
      ws.send(JSON.stringify(connectEvent));

      // Trigger immediate snapshot for instant UI hydration
      emitStatsSnapshot().catch(() => {});


      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        logger.info({ totalClients: this.clients.size }, 'WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        logger.error({ err: err.message }, 'WebSocket client error');
        this.clients.delete(ws);
      });
    });

    this.startPingPongKeepalive();
    this.setupRedisSubscriber();
  }

  /**
   * Broadcasts a JSON event to all currently connected authenticated WS clients.
   */
  public broadcast<T>(event: WsEvent<T>): void {
    if (this.clients.size === 0) return;

    const messageStr = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }

  /**
   * Returns the count of connected clients.
   */
  public getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Periodically pings clients every 30 seconds to terminate dead connections.
   */
  private startPingPongKeepalive(): void {
    this.pingInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.isAlive === false) {
          logger.info('Terminating inactive WebSocket client (ping timeout)');
          this.clients.delete(client);
          client.terminate();
        } else {
          client.isAlive = false;
          client.ping();
        }
      }
    }, 30000);
  }

  /**
   * Connects dedicated Redis subscriber client to broadcast Redis events to WebSocket clients.
   */
  private async setupRedisSubscriber(): Promise<void> {
    try {
      this.subscriberRedis = createRedisClient();
      await this.subscriberRedis.connect();
      await this.subscriberRedis.subscribe(REDIS_JOB_EVENTS_CHANNEL);

      this.subscriberRedis.on('message', (channel, message) => {
        if (channel === REDIS_JOB_EVENTS_CHANNEL) {
          try {
            const event: WsEvent = JSON.parse(message);
            this.broadcast(event);
          } catch (err) {
            logger.warn({ message }, 'Received non-JSON event on Redis channel');
          }
        }
      });

      logger.info('WsManager subscribed to Redis pub/sub channel for real-time events');
    } catch (err: any) {
      logger.warn({ err: err.message }, 'WsManager operating without Redis PubSub fallback');
    }
  }

  public close(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.subscriberRedis) this.subscriberRedis.disconnect();
    this.wss.close();
  }
}

let wsManagerInstance: WsManager | null = null;

export function initWsManager(server: HttpServer): WsManager {
  if (!wsManagerInstance) {
    wsManagerInstance = new WsManager(server);
  }
  return wsManagerInstance;
}

export function getWsManager(): WsManager | null {
  return wsManagerInstance;
}
