import path from 'path';

export function safeFilePath(base: string, untrusted: string): string {
  const resolved = path.resolve(base, untrusted);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}
