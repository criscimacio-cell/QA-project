/**
 * AES-256-GCM encryption at rest for uploaded files.
 *
 * On-disk format for encrypted files:
 *   [6 bytes magic "QLENC1"] [12 bytes IV] [16 bytes GCM auth tag] [N bytes ciphertext]
 *
 * The magic header lets us distinguish encrypted files from legacy plaintext
 * files uploaded before encryption was enabled — those are served as-is.
 *
 * Key: FILE_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Without the key, files pass through unencrypted (warned once on startup).
 */

import crypto from 'crypto';
import fs from 'fs';
import { logger } from './logger';

const MAGIC = Buffer.from('QLENC1');  // 6 bytes — marks an encrypted file
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + IV_LENGTH + TAG_LENGTH; // 34 bytes

let _warned = false;

function getKey(): Buffer | null {
  const hex = process.env.FILE_ENCRYPTION_KEY;
  if (!hex) {
    if (!_warned) {
      logger.warn('FILE_ENCRYPTION_KEY not set — files stored unencrypted');
      _warned = true;
    }
    return null;
  }
  if (hex.length !== 64) throw new Error('FILE_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  return Buffer.from(hex, 'hex');
}

function isEncrypted(data: Buffer): boolean {
  return data.length >= MAGIC.length && data.subarray(0, MAGIC.length).equals(MAGIC);
}

/**
 * Encrypts a file in-place after multer saves it to disk.
 * No-op if FILE_ENCRYPTION_KEY is not set.
 */
export function encryptFile(filePath: string): void {
  const key = getKey();
  if (!key) return;

  const plaintext = fs.readFileSync(filePath);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  fs.writeFileSync(filePath, Buffer.concat([MAGIC, iv, tag, ciphertext]));
}

/**
 * Returns the plaintext Buffer for a file path.
 * - Encrypted files (QLENC1 header): decrypted with the key.
 * - Legacy plaintext files (no header): returned as-is for backward compatibility.
 */
export function decryptFileToBuffer(filePath: string): Buffer {
  const key = getKey();
  const data = fs.readFileSync(filePath);

  if (!isEncrypted(data)) return data; // legacy plaintext — serve directly

  if (!key) {
    // Key was unset when file was written (shouldn't happen), return raw
    return data;
  }

  if (data.length < HEADER_LENGTH) throw new Error('Encrypted file too short — may be corrupt');

  const iv = data.subarray(MAGIC.length, MAGIC.length + IV_LENGTH);
  const tag = data.subarray(MAGIC.length + IV_LENGTH, HEADER_LENGTH);
  const ciphertext = data.subarray(HEADER_LENGTH);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
