import { toast } from 'sonner';

export async function downloadWithPasswordPrompt(fileId: number, filename: string, isPasswordProtected?: boolean) {
  const attempt = async (password?: string): Promise<void> => {
    const headers: HeadersInit = {};
    if (password) headers['X-File-Password'] = password;
    const res = await fetch(`/api/files/${fileId}/download`, { credentials: 'include', headers });

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}));
      const hint = data.hint ? `\nHint: ${data.hint}` : '';
      const pw = window.prompt(`This file is password protected.${hint}\n\nEnter password:`);
      if (pw === null) return;
      return attempt(pw);
    }

    if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      const remaining = data.attempts_remaining ?? 0;
      if (remaining <= 0) { toast.error('Too many wrong attempts. Try again later.'); return; }
      const pw = window.prompt(`Incorrect password. ${remaining} attempt(s) remaining.\n\nEnter password:`);
      if (pw === null) return;
      return attempt(pw);
    }

    if (res.status === 429) { toast.error('Too many download requests. Please wait.'); return; }
    if (!res.ok) { toast.error('Download failed — file not found on disk.'); return; }

    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  try {
    await attempt();
  } catch {
    toast.error('Download failed');
  }
}
