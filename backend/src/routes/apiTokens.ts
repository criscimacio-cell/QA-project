import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import sql from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();

function generateToken(): { raw: string; hash: string; prefix: string } {
  const raw = 'qlr_' + crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}

// List tokens for current user
router.get('/', authenticate, async (req: Request, res: Response) => {
  const tokens = await sql`
    SELECT id, name, token_prefix, scopes, last_used_at, expires_at, revoked, created_at
    FROM api_tokens
    WHERE user_id = ${req.user!.userId} AND organization_id = ${req.user!.organizationId}
    ORDER BY created_at DESC
  `;
  res.json(tokens);
});

// Create a new token
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { name, scopes, expires_in_days } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: 'Token name is required' }); return; }
  const { raw, hash, prefix } = generateToken();
  const expiresAt = expires_in_days
    ? new Date(Date.now() + Number(expires_in_days) * 86400000)
    : null;
  const [token] = await sql`
    INSERT INTO api_tokens (user_id, organization_id, name, token_hash, token_prefix, scopes, expires_at)
    VALUES (${req.user!.userId}, ${req.user!.organizationId}, ${name.trim()}, ${hash}, ${prefix}, ${scopes || 'read'}, ${expiresAt})
    RETURNING id, name, token_prefix, scopes, expires_at, created_at
  `;
  res.json({ ...token, raw_token: raw });
});

// Revoke a token
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  const [token] = await sql`SELECT id FROM api_tokens WHERE id = ${req.params.id} AND user_id = ${req.user!.userId}`;
  if (!token) { res.status(404).json({ error: 'Token not found' }); return; }
  await sql`UPDATE api_tokens SET revoked = TRUE WHERE id = ${req.params.id}`;
  res.json({ message: 'Token revoked' });
});

export default router;
