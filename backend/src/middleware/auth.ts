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

export const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction): void => {
  const userRole = req.user?.role;
  if (!userRole) { res.status(401).json({ error: 'Unauthorized' }); return; }
  // Admin always passes
  if (userRole === 'admin') { next(); return; }
  // If only admin is allowed, deny non-admins
  if (roles.length === 1 && roles[0] === 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }
  // Hardcoded roles pass if in list
  if (roles.includes(userRole)) { next(); return; }
  // Custom roles (not in the hardcoded list) pass for non-admin-only routes
  const hardcodedRoles = ['admin', 'lead', 'engineer', 'viewer'];
  if (!hardcodedRoles.includes(userRole)) { next(); return; }
  res.status(403).json({ error: 'Forbidden' });
};
