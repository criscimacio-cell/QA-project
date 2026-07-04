import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { encryptFile, decryptFileToBuffer } from '../fileEncryption';

const ORIGINAL_KEY = process.env.FILE_ENCRYPTION_KEY;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qlarity-enc-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.env.FILE_ENCRYPTION_KEY = ORIGINAL_KEY;
});

function writeFile(content: string): string {
  const p = path.join(tmpDir, 'file.bin');
  fs.writeFileSync(p, content);
  return p;
}

describe('fileEncryption', () => {
  it('round-trips content through encrypt then decrypt', () => {
    const p = writeFile('the quick brown fox jumps over the lazy dog');
    encryptFile(p);
    const decrypted = decryptFileToBuffer(p);
    expect(decrypted.toString()).toBe('the quick brown fox jumps over the lazy dog');
  });

  it('encrypts the same content differently each time (unique IV)', () => {
    const p1 = writeFile('identical content');
    const p2 = path.join(tmpDir, 'file2.bin');
    fs.writeFileSync(p2, 'identical content');
    encryptFile(p1);
    encryptFile(p2);
    const c1 = fs.readFileSync(p1);
    const c2 = fs.readFileSync(p2);
    expect(c1.equals(c2)).toBe(false);
    expect(decryptFileToBuffer(p1).toString()).toBe('identical content');
    expect(decryptFileToBuffer(p2).toString()).toBe('identical content');
  });

  it('marks the on-disk file with the QLENC1 magic header', () => {
    const p = writeFile('anything');
    encryptFile(p);
    const onDisk = fs.readFileSync(p);
    expect(onDisk.subarray(0, 6).toString()).toBe('QLENC1');
  });

  it('rejects a tampered ciphertext instead of returning corrupted plaintext', () => {
    const p = writeFile('sensitive contents');
    encryptFile(p);
    const data = fs.readFileSync(p);
    // Flip a byte inside the ciphertext (after the 34-byte header) so the
    // GCM auth tag no longer matches — this must fail loudly, not silently
    // hand back tampered data.
    data[40] = data[40] ^ 0xff;
    fs.writeFileSync(p, data);
    expect(() => decryptFileToBuffer(p)).toThrow();
  });

  it('serves a legacy plaintext file (no QLENC1 header) as-is', () => {
    const p = writeFile('this file predates encryption being enabled');
    const result = decryptFileToBuffer(p);
    expect(result.toString()).toBe('this file predates encryption being enabled');
  });

  it('leaves files unencrypted when FILE_ENCRYPTION_KEY is unset', () => {
    delete process.env.FILE_ENCRYPTION_KEY;
    const p = writeFile('no key configured');
    encryptFile(p);
    const onDisk = fs.readFileSync(p);
    expect(onDisk.toString()).toBe('no key configured');
    expect(decryptFileToBuffer(p).toString()).toBe('no key configured');
  });
});
