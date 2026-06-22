import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { parse as parseUrl } from 'url';
import { parse as parseCookie } from 'cookie';
import { JWT_SECRET } from './middleware/auth';
import { JwtPayload } from './types';

// Registry: userId -> set of active WebSocket connections
const registry = new Map<number, Set<WebSocket>>();

export function pushToUser(userId: number, payload: object): void {
  const sockets = registry.get(userId);
  if (!sockets || sockets.size === 0) return;
  const data = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
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
