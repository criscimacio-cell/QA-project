import { useEffect, useRef, useCallback } from 'react';

type NotificationPayload = {
  type: 'notification';
  notification: {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    organization_id: number;
  };
};

type OnNotification = (notification: NotificationPayload['notification']) => void;

// Same-origin by default — nginx (prod) and the Vite dev proxy (dev) both
// forward /ws to the backend, matching how /api is already proxied. A
// hardcoded ':3001' fallback here would bypass that proxy entirely and
// break in any deployment where the backend isn't reachable on that port
// directly (e.g. the docker-compose setup, where it never is).
const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (window.location.protocol === 'https:' ? 'wss' : 'ws') + '://' + window.location.host;

const MIN_BACKOFF = 1000;
const MAX_BACKOFF = 30000;

export function useNotificationSocket(onNotification: OnNotification, enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const backoffRef = useRef(MIN_BACKOFF);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  const connect = useCallback(() => {
    if (unmountedRef.current || !enabled) return;

    // Browser sends httpOnly cookies automatically on same-origin WS upgrade
    const ws = new WebSocket(`${WS_BASE}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      backoffRef.current = MIN_BACKOFF;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as NotificationPayload;
        if (data.type === 'notification' && data.notification) {
          onNotificationRef.current(data.notification);
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (event) => {
      if (unmountedRef.current) return;
      // 4001 = auth failure — don't reconnect
      if (event.code === 4001) return;
      // Schedule reconnect with exponential backoff
      timerRef.current = setTimeout(() => {
        if (!unmountedRef.current) {
          backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
          connect();
        }
      }, backoffRef.current);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, reconnect handled there
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect, enabled]);
}
