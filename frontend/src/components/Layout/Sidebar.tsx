import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Files, Search, BookOpen,
  Database, GitPullRequest, Users, ShieldCheck, Settings,
  ChevronLeft, ChevronRight, Layers, LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

const nav = [
  {
    section: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/repositories', icon: FolderOpen, label: 'Repositories' },
      { to: '/files', icon: Files, label: 'File Manager' },
      { to: '/search', icon: Search, label: 'Search' },
    ],
  },
  {
    section: 'Content',
    items: [
      { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
      { to: '/test-data', icon: Database, label: 'Test Data Library' },
      { to: '/approvals', icon: GitPullRequest, label: 'Approval Workflow' },
    ],
  },
];

const adminNav = [
  { to: '/users', icon: Users, label: 'User Management' },
  { to: '/audit', icon: ShieldCheck, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, isLead, logout } = useAuth();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-300 ease-in-out',
        'glass-sidebar',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{
        boxShadow: '2px 0 20px rgba(0,0,0,0.06)',
      }}
    >
      {/* Dark mode subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-none opacity-0 dark:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(180deg, rgba(8,164,156,0.04) 0%, transparent 40%, rgba(6,182,212,0.02) 100%)',
        }}
      />

      {/* ── Logo area ── */}
      <div
        className={clsx(
          'relative z-10 flex items-center gap-3 px-3 border-b transition-all duration-300',
          'border-slate-100 dark:border-slate-800/80',
          collapsed ? 'py-[1.125rem] justify-center' : 'py-[1.125rem] px-4',
        )}
        style={{
          background: 'linear-gradient(135deg, rgba(8,164,156,0.06), rgba(6,182,212,0.03))',
        }}
      >
        {/* Animated border line at bottom of logo area */}
        <div
          className="absolute bottom-0 left-4 right-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(8,164,156,0.3), transparent)' }}
        />

        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, #08a49c, #06b6d4)',
            boxShadow: '0 4px 14px rgba(8,164,156,0.4)',
          }}
        >
          <Layers size={17} className="text-white" style={{ animation: collapsed ? 'none' : 'float 4s ease-in-out infinite' }} />
        </div>

        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <div className="font-extrabold text-sm text-slate-900 dark:text-white tracking-tight">
              Q-KTAMP
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              QA Asset Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-4 space-y-5 px-2">
        {nav.map(section => (
          <div key={section.section}>
            {!collapsed && (
              <div
                className="px-3 mb-2 text-xs font-bold uppercase tracking-widest animate-fade-in"
                style={{ color: 'rgba(8,164,156,0.6)' }}
              >
                {section.section}
              </div>
            )}
            {collapsed && (
              <div className="px-1.5 mb-2">
                <div
                  className="h-px w-full rounded-full"
                  style={{ background: 'rgba(8,164,156,0.2)' }}
                />
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    clsx(
                      isActive ? 'sidebar-link-active' : 'sidebar-link',
                      collapsed && 'justify-center !px-0 !pl-0',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="nav-indicator" />}
                      <item.icon
                        size={18}
                        className={clsx(
                          'sidebar-icon flex-shrink-0',
                          isActive
                            ? 'text-[#08a49c] dark:text-[#5eead4]'
                            : 'text-slate-500 dark:text-slate-500',
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate transition-all duration-200">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {/* Admin section */}
        {isLead && (
          <div>
            {!collapsed && (
              <div
                className="px-3 mb-2 text-xs font-bold uppercase tracking-widest animate-fade-in"
                style={{ color: 'rgba(239,68,68,0.55)' }}
              >
                Admin
              </div>
            )}
            {collapsed && (
              <div className="px-1.5 mb-2">
                <div
                  className="h-px w-full rounded-full"
                  style={{ background: 'rgba(239,68,68,0.2)' }}
                />
              </div>
            )}
            <div className="space-y-0.5">
              {adminNav.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    clsx(
                      isActive ? 'sidebar-link-active' : 'sidebar-link',
                      collapsed && 'justify-center !px-0 !pl-0',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="nav-indicator" />}
                      <item.icon
                        size={18}
                        className={clsx(
                          'sidebar-icon flex-shrink-0',
                          isActive
                            ? 'text-[#08a49c] dark:text-[#5eead4]'
                            : 'text-slate-500 dark:text-slate-500',
                        )}
                      />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* ── User card ── */}
      <div
        className="relative z-10 p-3 border-t border-slate-100 dark:border-slate-800/80"
        style={{
          background: 'linear-gradient(135deg, rgba(8,164,156,0.04), rgba(6,182,212,0.02))',
        }}
      >
        {!collapsed ? (
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
            style={{
              background: 'rgba(248,250,252,0.8)',
              border: '1px solid rgba(226,232,240,0.7)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(8,164,156,0.06)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(8,164,156,0.2)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,250,252,0.8)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(226,232,240,0.7)';
            }}
          >
            <div className="relative flex-shrink-0">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt=""
                className="w-8 h-8 rounded-full bg-slate-200"
                style={{ border: '2px solid rgba(8,164,156,0.3)' }}
              />
              <span className="online-indicator" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold text-slate-900 dark:text-white truncate leading-none">
                {user?.name}
              </div>
              <div
                className="text-xs font-medium capitalize mt-0.5 truncate"
                style={{ color: '#08a49c' }}
              >
                {user?.role}
              </div>
            </div>
            <LogOut
              size={14}
              className="text-slate-400 group-hover:text-red-400 transition-colors flex-shrink-0"
            />
          </button>
        ) : (
          <div className="flex justify-center">
            <div className="relative">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt=""
                className="w-8 h-8 rounded-full bg-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ border: '2px solid rgba(8,164,156,0.35)' }}
                onClick={logout}
                title={`${user?.name} · Sign out`}
              />
              <span className="online-indicator" />
            </div>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={onToggle}
        className="absolute -right-3.5 top-[4.5rem] w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 z-50"
        style={{
          background: 'white',
          border: '1.5px solid rgba(8,164,156,0.25)',
          boxShadow: '0 2px 10px rgba(8,164,156,0.2)',
          color: '#08a49c',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = '#08a49c';
          (e.currentTarget as HTMLElement).style.color = 'white';
          (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = 'white';
          (e.currentTarget as HTMLElement).style.color = '#08a49c';
          (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
        }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  );
}
