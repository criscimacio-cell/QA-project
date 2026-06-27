import { toast } from 'sonner';

export type DownloadResult =
  | { done: true }
  | { needsPassword: true; hint: string | null }
  | { wrongPassword: true; attemptsRemaining: number }
  | { locked: true; retryAfter: number };

function triggerBlobDownload(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

/**
 * Low-level download — returns a result object so the caller can drive
 * its own UI (modal, inline error, etc.). Used by FileManager.
 */
export async function downloadFile(
  url: string,
  filename: string,
  password?: string
): Promise<DownloadResult> {
  try {
    const headers: HeadersInit = {};
    if (password) headers['X-File-Password'] = password;
    const res = await fetch(url, { credentials: 'include', headers });

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      return { needsPassword: true, hint: data.hint ?? null };
    }
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      return { wrongPassword: true, attemptsRemaining: data.attempts_remaining ?? 0 };
    }
    if (res.status === 429) {
      const data = await res.json().catch(() => ({}));
      return { locked: true, retryAfter: data.retry_after ?? 900 };
    }
    if (!res.ok) {
      toast.error('Download failed — file not found on disk.');
      return { done: true };
    }

    const blob = await res.blob();
    triggerBlobDownload(blob, filename);
    return { done: true };
  } catch {
    toast.error('Download failed');
    return { done: true };
  }
}

/**
 * High-level download with automatic window.prompt() password loop.
 * Used by pages that don't have a custom password modal (Search, TestDataLibrary).
 */
export async function downloadWithPasswordPrompt(
  fileId: number,
  filename: string,
  _isPasswordProtected?: boolean
): Promise<void> {
  const attempt = async (password?: string): Promise<void> => {
    const url = `/api/files/${fileId}/download`;
    const result = await downloadFile(url, filename, password);

    if ('needsPassword' in result) {
      const hint = result.hint ? `\nHint: ${result.hint}` : '';
      const pw = window.prompt(`This file is password protected.${hint}\n\nEnter password:`);
      if (pw === null) return;
      return attempt(pw);
    }
    if ('wrongPassword' in result) {
      if (result.attemptsRemaining <= 0) { toast.error('Too many wrong attempts. Try again later.'); return; }
      const pw = window.prompt(`Incorrect password. ${result.attemptsRemaining} attempt(s) remaining.\n\nEnter password:`);
      if (pw === null) return;
      return attempt(pw);
    }
    if ('locked' in result) {
      toast.error('Too many download requests. Please wait.');
    }
    // 'done' — nothing more to do
  };

  await attempt();
}
