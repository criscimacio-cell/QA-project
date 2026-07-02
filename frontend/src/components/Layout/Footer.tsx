import { Heart } from 'lucide-react';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    // Was `fixed bottom-0`, pinned to the viewport regardless of scroll — on
    // any page taller than one screen (Audit Log, long file/user lists) it
    // permanently overlapped the last ~40px of content. Now a normal flow
    // element; `flex-1` on the content area above it in AppLayout still keeps
    // it pinned to the bottom on short pages, without covering content on tall ones.
    <footer
      className="border-t px-6 py-3 flex items-center justify-between"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
        © {year} Qlarity. Built with
        <Heart size={11} className="text-red-400 fill-red-400 mx-0.5" />
        for your team.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500">
        Powered by <span className="font-semibold text-slate-500 dark:text-slate-400">Stash Ph Pinas Inc.</span>
      </p>
    </footer>
  );
}
