import { useState, useEffect, useRef, useCallback } from 'react';
import { WsEvent } from '@job-scheduler/shared';

export type WsConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

interface UseWebSocketOptions {
  url?: string;
  getToken: () => Promise<string>;
  enabled?: boolean;
  onEvent?: (event: WsEvent) => void;
}

export function useWebSocket({
  url,
  getToken,
  enabled = true,
  onEvent,
}: UseWebSocketOptions) {
  const [status, setStatus] = useState<WsConnectionStatus>('DISCONNECTED');
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [latency, setLatency] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);
  const pingTimeRef = useRef<number>(0);

  const onEventRef = useRef(onEvent);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    onEventRef.current = onEvent;
    getTokenRef.current = getToken;
  }, [onEvent, getToken]);

  const defaultUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:3000/ws`;
  const wsUrl = url || defaultUrl;

  const connect = useCallback(async () => {
    if (!enabled) return;

    // Prevent duplicate connections if already open or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      setStatus(prev => (prev === 'CONNECTED' ? 'CONNECTED' : 'CONNECTING'));

      const token = await getTokenRef.current();
      if (!token) {
        setStatus('DISCONNECTED');
        return;
      }

      const fullUrl = `${wsUrl}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(fullUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setStatus('CONNECTED');
        backoffRef.current = 1000;
        pingTimeRef.current = Date.now();
      };

      socket.onmessage = (event) => {
        try {
          const data: WsEvent = JSON.parse(event.data);
          setLastEvent(data);

          if (data.type === 'connected') {
            setLatency(Date.now() - pingTimeRef.current);
          }

          if (onEventRef.current) {
            onEventRef.current(data);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket frame:', err);
        }
      };

      socket.onerror = (err) => {
        console.warn('WebSocket error encountered:', err);
      };

      socket.onclose = () => {
        wsRef.current = null;

        if (enabled) {
          setStatus('RECONNECTING');
          const delay = backoffRef.current;
          backoffRef.current = Math.min(backoffRef.current * 1.5, 15000);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setStatus('DISCONNECTED');
        }
      };
    } catch (err) {
      console.error('Error establishing WebSocket connection:', err);
      setStatus('DISCONNECTED');
    }
  }, [enabled, wsUrl]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setStatus('DISCONNECTED');
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [enabled, connect]);

  return {
    status,
    lastEvent,
    latency,
    reconnect: connect,
  };
}
