import { Heart } from 'lucide-react';

export default function Footer({ sidebarWidth }: { sidebarWidth: number }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="transition-all duration-300 ease-in-out border-t px-6 py-3 flex items-center justify-between fixed bottom-0 right-0 z-[49]"
      style={{
        left: sidebarWidth,
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
        © {year} Qlarity. Built with
        <Heart size={11} className="text-red-400 fill-red-400 mx-0.5" />
        for your team.
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Powered by <span className="font-semibold text-slate-500 dark:text-slate-400">Stash Ph Pinas Inc.</span>
      </p>
    </footer>
  );
}
