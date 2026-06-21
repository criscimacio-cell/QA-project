import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import sql from '../db';
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

const HARDCODED_ROLES = ['admin', 'lead', 'engineer', 'viewer'];
const RESERVED_ROLE_NAMES = new Set(['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf', 'admin', 'lead', 'engineer', 'viewer']);

export { RESERVED_ROLE_NAMES };

export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  const userRole = req.user?.role;
  if (!userRole) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (userRole === 'admin') { next(); return; }
  if (roles.length === 1 && roles[0] === 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  if (roles.includes(userRole)) { next(); return; }
  // Custom roles are denied here — use requireModule for module-gated routes
  if (!HARDCODED_ROLES.includes(userRole)) { res.status(403).json({ error: 'Forbidden' }); return; }
  res.status(403).json({ error: 'Forbidden' });
};

// requireModule checks role_permissions JSONB for custom roles, allowing fine-grained access control
export const requireModule = (module: string) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const userRole = req.user?.role;
  if (!userRole) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (userRole === 'admin') { next(); return; }

  if (!HARDCODED_ROLES.includes(userRole)) {
    // Custom role — consult role_permissions in DB
    try {
      const [org] = await sql`SELECT role_permissions FROM organizations WHERE id = ${req.user!.organizationId}`;
      const perms = org?.role_permissions?.[userRole];
      if (perms?.[module] === true) { next(); return; }
      res.status(403).json({ error: 'Forbidden' }); return;
    } catch {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
  }

  // Hardcoded roles (lead, engineer, viewer) pass if they're in the allowed list
  // This keeps backward compatibility for routes that haven't migrated to requireModule yet
  next();
};
