// Shim to load the ESM-only file-type package from a CommonJS context.
// Dynamic import() works at runtime; we cast the return to avoid TS moduleResolution errors.
export async function fileTypeFromBuffer(buf: Buffer): Promise<{ ext: string; mime: string } | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await (Function('return import("file-type")')() as Promise<any>);
  return mod.fileTypeFromBuffer(buf);
}
