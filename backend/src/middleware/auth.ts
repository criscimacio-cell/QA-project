import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';

export const JWT_SECRET = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
};

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Prefer httpOnly cookie; fall back to Authorization header for API clients
  const token = req.cookies?.accessToken ?? req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET(), { algorithms: ['HS256'] }) as JwtPayload;
    if (!payload.organizationId) {
      // Stale token from before multi-tenancy — force re-login
      res.status(401).json({ error: 'Session expired, please log in again' });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
