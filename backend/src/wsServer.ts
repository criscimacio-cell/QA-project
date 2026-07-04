import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as parseUrl } from 'url';
import { parse as parseCookie } from 'cookie';
import { JWT_SECRET } from './middleware/auth';
import { JwtPayload } from './types';
import { redis } from './redis';
import { logger } from './logger';

// Registry: userId -> set of active WebSocket connections. This is always
// process-local — a live socket can't be handed to another backend replica —
// so with more than one replica, the user's socket may be on a *different*
// instance than the one handling the request that triggers a notification.
const registry = new Map<number, Set<WebSocket>>();

const WS_NOTIFY_CHANNEL = 'ws:notify';

// Dedicated connection for SUBSCRIBE: an ioredis connection in subscriber
// mode can't issue other commands, so this can't share the general-purpose
// `redis` client used elsewhere for caching/queues.
const subscriber = redis.duplicate();
subscriber.on('error', (err) => {
  if ((err as any).code !== 'ECONNREFUSED') logger.error({ err }, '[ws] Redis subscriber error');
});
subscriber.subscribe(WS_NOTIFY_CHANNEL).catch((err) => {
  logger.error({ err }, '[ws] Failed to subscribe to notification channel');
});
subscriber.on('message', (channel, message) => {
  if (channel !== WS_NOTIFY_CHANNEL) return;
  try {
    const { userId, payload } = JSON.parse(message) as { userId: number; payload: object };
    deliverLocal(userId, payload);
  } catch {
    // ignore malformed pub/sub payloads
  }
});

function deliverLocal(userId: number, payload: object): void {
  const sockets = registry.get(userId);
  if (!sockets || sockets.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

// Publishes to every backend replica (including this one) rather than
// writing to the local registry directly, so the message reaches the user's
// socket regardless of which instance is handling it. If Redis is down, the
// publish can't reach any replica anyway, so falling back to a local-only
// delivery attempt is a strict improvement (helps the common single-instance
// case) and can't cause a duplicate delivery.
export async function pushToUser(userId: number, payload: object): Promise<void> {
  try {
    await redis.publish(WS_NOTIFY_CHANNEL, JSON.stringify({ userId, payload }));
  } catch (err) {
    logger.error({ err }, '[ws] Failed to publish notification, falling back to local delivery');
    deliverLocal(userId, payload);
  }
}

function resolveToken(req: IncomingMessage): string | null {
  // 1. Try query string ?token=xxx
  const { query } = parseUrl(req.url || '', true);
  if (query.token && typeof query.token === 'string') return query.token;

  // 2. Try cookie header
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = parseCookie(cookieHeader);
    if (cookies.accessToken) return cookies.accessToken;
  }

  return null;
}

export function attachWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const token = resolveToken(req);

    if (!token) {
      ws.close(4001, 'Unauthorized: no token');
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET(), { algorithms: ['HS256'] }) as JwtPayload;
    } catch {
      ws.close(4001, 'Unauthorized: invalid token');
      return;
    }

    if (!payload.organizationId) {
      ws.close(4001, 'Unauthorized: stale token');
      return;
    }

    const { userId } = payload;

    // Register
    if (!registry.has(userId)) registry.set(userId, new Set());
    registry.get(userId)!.add(ws);

    ws.on('close', () => {
      const sockets = registry.get(userId);
      if (sockets) {
        sockets.delete(ws);
        if (sockets.size === 0) registry.delete(userId);
      }
    });

    // Ignore any incoming messages from client
    ws.on('message', () => {});
  });

  return wss;
}
