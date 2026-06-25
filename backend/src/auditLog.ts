/**
 * Tamper-evident audit log insertion.
 * Each row stores SHA-256(previous_row_hash || action || details || created_at_iso).
 * If any row is deleted or modified the chain breaks and can be detected by auditors.
 */
import crypto from 'crypto';
import sql from './db';

export async function writeAuditLog(params: {
  userId: number | null;
  action: string;
  entityType: string;
  entityId: number | string;
  details: string;
  ipAddress: string;
  organizationId: number | null;
}): Promise<void> {
  const { userId, action, entityType, entityId, details, ipAddress, organizationId } = params;

  // Get the hash of the most recent row (for this org, or global if null)
  const [prev] = await sql`
    SELECT row_hash, created_at FROM audit_logs
    WHERE organization_id IS NOT DISTINCT FROM ${organizationId}
    ORDER BY id DESC LIMIT 1
  `;

  const prevHash = prev?.row_hash ?? '0000000000000000000000000000000000000000000000000000000000000000';
  const now = new Date().toISOString();
  const rowHash = crypto
    .createHash('sha256')
    .update(prevHash + action + details + now)
    .digest('hex');

  await sql`
    INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, details, ip_address, organization_id, row_hash, created_at)
    VALUES
      (${userId}, ${action}, ${entityType}, ${String(entityId)}, ${details}, ${ipAddress}, ${organizationId}, ${rowHash}, ${now})
  `;
}
