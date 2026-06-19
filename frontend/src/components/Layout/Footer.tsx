import { Github, Heart } from 'lucide-react';

export default function Footer({ sidebarWidth }: { sidebarWidth: number }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="transition-all duration-300 ease-in-out border-t px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 fixed bottom-0 right-0 z-[49]"
      style={{
        left: sidebarWidth,
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
        © {year} Qlarity. Built with
        <Heart size={11} className="text-red-400 fill-red-400 mx-0.5" />
        for QA teams.
      </p>

      <div className="flex items-center gap-4">
        <a href="#" className="text-xs text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
          Privacy Policy
        </a>
        <a href="#" className="text-xs text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
          Terms of Use
        </a>
        <a href="#" aria-label="GitHub repository" className="text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors">
          <Github size={14} />
        </a>
      </div>
    </footer>
  );
}
