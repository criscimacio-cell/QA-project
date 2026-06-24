import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import sql from '../db';
import { authenticate, requireModule } from '../middleware/auth';
import { decryptFileToBuffer } from '../fileEncryption';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const router = Router();

// Create share link for a file
router.post('/:id/share-links', authenticate, requireModule('files'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const fileId = parseInt(req.params.id);
  const [file] = await sql`SELECT id, name FROM files WHERE id = ${fileId} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }

  const { expires_in_days = 7, password, max_downloads, label } = req.body;
  const expiryDays = Math.min(Math.max(parseInt(expires_in_days) || 7, 1), 365);
  const expiresAt = new Date(Date.now() + expiryDays * 86400_000);
  const token = crypto.randomBytes(32).toString('hex');
  const pwHash = password ? await bcrypt.hash(password, 10) : null;

  const [link] = await sql`
    INSERT INTO file_share_links (token, file_id, created_by, organization_id, expires_at, password_hash, max_downloads, label)
    VALUES (${token}, ${fileId}, ${req.user!.userId}, ${orgId}, ${expiresAt.toISOString()}, ${pwHash}, ${max_downloads || null}, ${label || null})
    RETURNING id, token, expires_at, max_downloads, label, download_count
  `;

  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'SHARE_LINK_CREATE', 'file', ${fileId}, ${`Created share link for: ${file.name} (expires ${expiresAt.toISOString().slice(0,10)})`}, ${req.ip || ''}, ${orgId})`;
  const shareUrl = `${process.env.APP_URL || 'http://localhost:5173'}/share/${token}`;
  res.json({ ...link, url: shareUrl, password_protected: !!password });
});

// List share links for a file
router.get('/:id/share-links', authenticate, requireModule('files'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  const links = await sql`
    SELECT id, token, expires_at, max_downloads, download_count, label,
           (password_hash IS NOT NULL) as password_protected,
           created_at,
           (expires_at < NOW() OR (max_downloads IS NOT NULL AND download_count >= max_downloads)) as is_expired
    FROM file_share_links WHERE file_id = ${req.params.id}
    ORDER BY created_at DESC
  `;
  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  res.json(links.map((l: any) => ({ ...l, url: `${baseUrl}/share/${l.token}` })));
});

// Delete a share link
router.delete('/:id/share-links/:linkId', authenticate, requireModule('files'), async (req: Request, res: Response) => {
  const orgId = req.user!.organizationId;
  const [file] = await sql`SELECT id FROM files WHERE id = ${req.params.id} AND organization_id = ${orgId}`;
  if (!file) { res.status(404).json({ error: 'Not found' }); return; }
  await sql`DELETE FROM file_share_links WHERE id = ${req.params.linkId} AND file_id = ${req.params.id}`;
  await sql`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, organization_id) VALUES (${req.user!.userId}, 'SHARE_LINK_DELETE', 'file', ${req.params.id}, ${`Deleted share link id=${req.params.linkId}`}, ${req.ip || ''}, ${orgId})`;
  res.json({ message: 'Link deleted' });
});

// Public download via share token (no auth required)
router.get('/public/:token', async (req: Request, res: Response) => {
  const [link] = await sql`
    SELECT sl.*, f.path, f.original_name, f.mime_type, f.name as file_name
    FROM file_share_links sl
    JOIN files f ON sl.file_id = f.id
    WHERE sl.token = ${req.params.token}
  `;
  if (!link) { res.status(404).json({ error: 'Link not found or expired' }); return; }
  if (new Date(link.expires_at) < new Date()) { res.status(410).json({ error: 'This link has expired' }); return; }
  if (link.max_downloads !== null && link.download_count >= link.max_downloads) {
    res.status(410).json({ error: 'Download limit reached for this link' }); return;
  }

  // Password check
  if (link.password_hash) {
    const provided = req.headers['x-share-password'] as string | undefined;
    if (!provided) { res.status(403).json({ error: 'password_required' }); return; }
    const valid = await bcrypt.compare(provided, link.password_hash);
    if (!valid) { res.status(401).json({ error: 'invalid_password' }); return; }
  }

  // Increment download count
  await sql`UPDATE file_share_links SET download_count = download_count + 1 WHERE id = ${link.id}`;

  const filePath = path.join(UPLOAD_DIR, link.path);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found on disk' }); return; }

  try {
    const decrypted = decryptFileToBuffer(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(link.original_name)}"`);
    res.setHeader('Content-Type', link.mime_type || 'application/octet-stream');
    res.setHeader('Content-Length', decrypted.length);
    res.end(decrypted);
  } catch { res.status(500).json({ error: 'Failed to serve file' }); }
});

// Get share link info (public, for the share page UI)
router.get('/public/:token/info', async (req: Request, res: Response) => {
  const [link] = await sql`
    SELECT sl.id, sl.expires_at, sl.max_downloads, sl.download_count, sl.label,
           (sl.password_hash IS NOT NULL) as password_protected,
           f.name as file_name, f.original_name, f.size, f.mime_type
    FROM file_share_links sl
    JOIN files f ON sl.file_id = f.id
    WHERE sl.token = ${req.params.token}
  `;
  if (!link) { res.status(404).json({ error: 'Link not found' }); return; }
  if (new Date(link.expires_at) < new Date()) { res.status(410).json({ error: 'expired' }); return; }
  if (link.max_downloads !== null && link.download_count >= link.max_downloads) {
    res.status(410).json({ error: 'limit_reached' }); return;
  }
  res.json(link);
});

export default router;
