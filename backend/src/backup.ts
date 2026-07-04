import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import zlib from 'zlib';
// archiver@8 ships as ESM-only with no default export — `require('archiver')`
// resolves to its named exports, so the old `archiver('zip', opts)` factory
// call throws "archiver is not a function". Use the ZipArchive class instead.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ZipArchive } = require('archiver') as { ZipArchive: new (opts?: object) => import('archiver').Archiver };
import { logger } from './logger';

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || './backups');

const DAILY_RETENTION_DAYS = 7;
const WEEKLY_RETENTION_DAYS = 28;
const DATE_FOLDER_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Dumps the whole database via pg_dump, gzipped straight to disk. Uses an
// argument array (never a shell string) so DATABASE_URL's credentials can't
// end up interpreted as shell syntax.
async function dumpDatabase(destDir: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set — cannot back up the database');
  const outPath = path.join(destDir, 'db.sql.gz');

  await new Promise<void>((resolve, reject) => {
    const pgDump = spawn('pg_dump', ['--dbname', dbUrl, '--no-owner', '--no-privileges'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const gzip = zlib.createGzip();
    const out = fs.createWriteStream(outPath);
    let stderr = '';

    pgDump.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    pgDump.on('error', reject);
    out.on('error', reject);
    gzip.on('error', reject);

    pgDump.stdout.pipe(gzip).pipe(out);

    pgDump.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`));
    });
  });
}

// Zips the uploads directory as-is. Files on disk are already
// AES-256-GCM-encrypted at rest (see fileEncryption.ts), so the archive
// inherits that protection with no extra work here.
async function archiveUploads(destDir: string): Promise<void> {
  const outPath = path.join(destDir, 'files.zip');

  if (!fs.existsSync(UPLOAD_DIR)) {
    // Nothing uploaded yet on a fresh install — leave a marker so the run
    // still shows as complete instead of silently missing a file.
    fs.writeFileSync(`${outPath}.empty`, '');
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = new ZipArchive({ zlib: { level: 6 } });
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(UPLOAD_DIR, 'uploads');
    archive.finalize();
  });
}

// Daily copies survive 7 days; after that only the Sunday copy survives,
// for 4 more weeks. Everything else is deleted on the next run.
function isKept(folderDate: Date, now: Date): boolean {
  const ageDays = Math.floor((now.getTime() - folderDate.getTime()) / (24 * 60 * 60 * 1000));
  if (ageDays < 0) return true; // clock skew safety net — never touch a "future" folder
  if (ageDays <= DAILY_RETENTION_DAYS) return true;
  if (ageDays <= WEEKLY_RETENTION_DAYS && folderDate.getUTCDay() === 0) return true;
  return false;
}

function rotateOldBackups(now: Date): { kept: string[]; pruned: string[] } {
  const kept: string[] = [];
  const pruned: string[] = [];
  if (!fs.existsSync(BACKUP_DIR)) return { kept, pruned };

  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    // Only ever touch folders this job itself created (YYYY-MM-DD), so a
    // stray file or unrelated folder dropped into BACKUP_DIR is never at risk.
    if (!DATE_FOLDER_RE.test(entry)) continue;
    const full = path.join(BACKUP_DIR, entry);
    if (!fs.statSync(full).isDirectory()) continue;

    const folderDate = new Date(`${entry}T00:00:00.000Z`);
    if (isKept(folderDate, now)) kept.push(entry);
    else { fs.rmSync(full, { recursive: true, force: true }); pruned.push(entry); }
  }
  return { kept, pruned };
}

export async function runBackup(): Promise<void> {
  const now = new Date();
  const stamp = dateStamp(now);
  const destDir = path.join(BACKUP_DIR, stamp);
  fs.mkdirSync(destDir, { recursive: true });

  await dumpDatabase(destDir);
  await archiveUploads(destDir);

  const { kept, pruned } = rotateOldBackups(now);
  logger.info(
    `[backup] ${stamp} complete — db + uploads written to ${destDir}. ` +
    `Retained ${kept.length} backup day(s)${pruned.length ? `, pruned ${pruned.length}: ${pruned.join(', ')}` : ''}.`
  );
}
