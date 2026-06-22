/**
 * AES-256-GCM file encryption at rest.
 *
 * On-disk format (binary):
 *   [12 bytes IV] [16 bytes GCM auth tag] [N bytes ciphertext]
 *
 * Key is read lazily from FILE_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * If the key is not set, files pass through unencrypted and a warning is logged
 * once — so the app still runs in dev without the key configured.
 *
 * SWAP GUIDE (future — key rotation):
 *   Add a key version byte at offset 0, keep old keys in a map, decrypt with
 *   the matching key, re-encrypt with the new one during a migration job.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const IV_LENGTH = 12;   // GCM recommended
const TAG_LENGTH = 16;  // GCM auth tag
const HEADER_LENGTH = IV_LENGTH + TAG_LENGTH; // 28 bytes prepended to every file

let _warned = false;

function getKey(): Buffer | null {
  const hex = process.env.FILE_ENCRYPTION_KEY;
  if (!hex) {
    if (!_warned) {
      console.warn('[fileEncryption] FILE_ENCRYPTION_KEY not set — files stored unencrypted');
      _warned = true;
    }
    return null;
  }
  if (hex.length !== 64) {
    throw new Error('FILE_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypts a file in-place (overwrites the plaintext with the encrypted version).
 * Called immediately after multer saves the upload to disk.
 */
export function encryptFile(filePath: string): void {
  const key = getKey();
  if (!key) return; // encryption disabled — passthrough

  const plaintext = fs.readFileSync(filePath);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Write: IV | tag | ciphertext
  fs.writeFileSync(filePath, Buffer.concat([iv, tag, ciphertext]));
}

/**
 * Returns a decrypted Buffer for the given encrypted file path.
 * Used for single-file download and preview.
 */
export function decryptFileToBuffer(filePath: string): Buffer {
  const key = getKey();
  if (!key) return fs.readFileSync(filePath); // passthrough

  const data = fs.readFileSync(filePath);
  if (data.length < HEADER_LENGTH) throw new Error('Encrypted file too short — may be corrupt');

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, HEADER_LENGTH);
  const ciphertext = data.subarray(HEADER_LENGTH);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Decrypts an encrypted file into a temp file, runs `fn(tempPath)`, then
 * cleans up. Used for bulk-download zip where archiver needs a file path.
 */
export async function withDecryptedFile<T>(
  encryptedPath: string,
  fn: (tempPath: string) => Promise<T>,
): Promise<T> {
  const key = getKey();
  if (!key) return fn(encryptedPath); // passthrough

  const tempPath = `${encryptedPath}.tmp_dec`;
  try {
    const plaintext = decryptFileToBuffer(encryptedPath);
    fs.writeFileSync(tempPath, plaintext);
    return await fn(tempPath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

/**
 * Generates a secure random FILE_ENCRYPTION_KEY.
 * Run once: node -e "const c=require('crypto');console.log(c.randomBytes(32).toString('hex'))"
 */
export function generateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
