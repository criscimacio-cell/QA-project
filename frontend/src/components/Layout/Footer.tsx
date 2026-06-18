import { Layers, Github, ExternalLink, Heart } from 'lucide-react';

const LINKS = [
  {
    heading: 'Platform',
    items: [
      { label: 'Dashboard',    href: '/' },
      { label: 'File Manager', href: '/files' },
      { label: 'Repositories', href: '/repositories' },
      { label: 'Knowledge Base', href: '/knowledge-base' },
    ],
  },
  {
    heading: 'Management',
    items: [
      { label: 'Audit Log',  href: '/audit' },
      { label: 'Users',      href: '/users' },
      { label: 'Settings',   href: '/settings' },
    ],
  },
  {
    heading: 'Resources',
    items: [
      { label: 'Documentation', href: '#', external: true },
      { label: 'API Reference',  href: '#', external: true },
      { label: 'Release Notes',  href: '#', external: true },
    ],
  },
];

export default function Footer({ sidebarWidth }: { sidebarWidth: number }) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="transition-all duration-300 ease-in-out border-t"
      style={{
        marginLeft: sidebarWidth,
        borderColor: 'var(--border)',
        background: 'var(--card)',
      }}
    >
      {/* Main footer body */}
      <div className="px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand column */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', boxShadow: '0 4px 12px rgba(245,158,11,0.35)' }}
              >
                <Layers size={15} color="white" />
              </div>
              <span className="font-extrabold text-base text-slate-800 dark:text-white tracking-tight">Qlarity</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed max-w-[180px]">
              QA Asset Platform — clarity in every QA decision.
            </p>

            {/* Version badge */}
            <div
              className="inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#D97706' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              v1.0.0 — Beta
            </div>
          </div>

          {/* Link columns */}
          {LINKS.map(col => (
            <div key={col.heading}>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">
                {col.heading}
              </p>
              <ul className="space-y-2">
                {col.items.map(item => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors duration-150 flex items-center gap-1 group"
                    >
                      {item.label}
                      {item.external && (
                        <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          © {year} Qlarity. Built with
          <Heart size={11} className="text-red-400 fill-red-400 mx-0.5" />
          for QA teams.
        </p>

        <div className="flex items-center gap-4">
          <a
            href="#"
            className="text-xs text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="text-xs text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            Terms of Use
          </a>
          <a
            href="#"
            aria-label="GitHub repository"
            className="text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          >
            <Github size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
