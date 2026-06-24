import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Files, Search, BookOpen,
  Database, GitPullRequest, Users, ShieldCheck, Settings, Archive,
  ChevronLeft, ChevronRight, Layers, Building2, Trash2, Lock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions, ModuleKey } from '../../context/PermissionsContext';
import { useTheme } from '../../context/ThemeContext';
import clsx from 'clsx';
import OrgSwitcher from '../UI/OrgSwitcher';

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

function renderNavSection(
  label: string,
  items: { to: string; icon: React.ElementType; label: string }[],
  startIdx: number,
  collapsed: boolean,
) {
  return (
    <div>
      {!collapsed && (
        <div className="px-3 mb-2 text-xs font-bold uppercase tracking-widest animate-fade-in" style={{ color: 'rgba(252,165,165,0.5)' }}>
          {label}
        </div>
      )}
      {collapsed && (
        <div className="px-1.5 mb-2">
          <div className="h-px w-full rounded-full border-slate-200 dark:border-slate-700/50 border-t" />
        </div>
      )}
      <div className="space-y-0.5">
        {items.map((item, idx) => (
          <div key={item.to} style={{ animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${(startIdx + idx) * 0.05}s` }}>
            <NavLink
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => clsx(isActive ? 'sidebar-link-active' : 'sidebar-link', collapsed && 'justify-center !px-0 !pl-0')}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="nav-indicator" style={{ animation: 'navIndicatorIn 0.2s ease forwards, pulsingDot 1.8s ease-in-out infinite 0.2s' }} />}
                  <item.icon size={18} className={clsx('sidebar-icon flex-shrink-0', isActive ? 'text-white' : 'text-white/60')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          </div>
        ))}
      </div>
    </div>
  );
}

const mainNav = [
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
    ],
  },
];

const formatRole = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const { canAccess } = usePermissions();

  const moduleMap: Record<string, ModuleKey> = {
    '/': 'dashboard',
    '/repositories': 'repositories',
    '/files': 'files',
    '/search': 'search',
    '/knowledge': 'knowledge',
    '/test-data': 'testData',
  };
  const leadNav = [
    { to: '/approvals', icon: GitPullRequest, label: 'Approval Workflow' },
    { to: '/checked-out', icon: Lock, label: 'Checked Out' },
  ].filter(() => canAccess('approvals'));
  const adminNav = [
    { to: '/users', icon: Users, label: 'User Management' },
    { to: '/org-settings', icon: Building2, label: 'Organization' },
    { to: '/audit', icon: ShieldCheck, label: 'Audit Log' },
    { to: '/archive', icon: Archive, label: 'Archive' },
    { to: '/trash', icon: Trash2, label: 'Trash' },
  ].filter(item => {
    const adminModuleMap: Record<string, ModuleKey> = {
      '/users': 'users',
      '/org-settings': 'orgSettings',
      '/audit': 'audit',
      '/archive': 'archive',
      '/trash': 'archive',
    };
    return canAccess(adminModuleMap[item.to] ?? 'dashboard');
  });
  const settingsNav = [
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];
  const { dark } = useTheme();

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full flex flex-col z-40 transition-all duration-300 ease-in-out sidebar-premium',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{
        boxShadow: dark
          ? '2px 0 40px rgba(0,0,0,0.5)'
          : '2px 0 20px rgba(0,0,0,0.15)',
      }}
    >
      {/* Subtle overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 30%, rgba(0,0,0,0.05) 100%)',
        }}
      />

      {/* ── Logo area ── */}
      <div
        className={clsx(
          'relative z-10 flex items-center gap-3 px-3 border-b transition-all duration-300',
          'border-white/10',
          collapsed ? 'py-[1.125rem] justify-center' : 'py-[1.125rem] px-4',
        )}
        style={{
          background: 'rgba(0,0,0,0.1)',
        }}
      >
        {/* Animated border line at bottom of logo area */}
        <div
          className="absolute bottom-0 left-4 right-4 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }}
        />

        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
          style={{
            background: 'rgba(255,255,255,0.15)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <Layers size={17} className="text-white" style={{ animation: collapsed ? 'none' : 'float 4s ease-in-out infinite' }} />
        </div>

        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <div
              className="font-extrabold text-sm tracking-tight text-white"
            >
              Qlarity
            </div>
            <div className="text-xs font-medium" style={{ color: 'rgba(252,211,77,0.85)' }}>
              Asset Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-4 space-y-5 px-2 scrollbar-thin">
        {mainNav.map(section => (
          <div key={section.section}>
            {!collapsed && (
              <div
                className="px-3 mb-2 text-xs font-bold uppercase tracking-widest animate-fade-in"
                style={{ color: 'rgba(252,211,77,0.5)' }}
              >
                {section.section}
              </div>
            )}
            {collapsed && (
              <div className="px-1.5 mb-2">
                <div className="h-px w-full rounded-full border-slate-200 dark:border-slate-700/50 border-t" />
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.filter(item => canAccess(moduleMap[item.to] ?? 'dashboard')).map((item, itemIdx) => {
                const sectionOffset = mainNav.indexOf(section);
                const globalIdx = mainNav.slice(0, sectionOffset).reduce((acc, s) => acc + s.items.length, 0) + itemIdx;
                return (
                  <div key={item.to} style={{ animation: 'fadeSlideIn 0.3s ease both', animationDelay: `${globalIdx * 0.05}s` }}>
                    <NavLink
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
                          {isActive && (
                            <span
                              className="nav-indicator"
                              style={{ animation: 'navIndicatorIn 0.2s ease forwards, pulsingDot 1.8s ease-in-out infinite 0.2s' }}
                            />
                          )}
                          <item.icon
                            size={18}
                            className={clsx(
                              'sidebar-icon flex-shrink-0',
                              isActive
                                ? 'text-white'
                                : 'text-white/60',
                            )}
                          />
                          {!collapsed && (
                            <span className="truncate transition-all duration-200">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Approval Workflow — visible to any role with approvals access */}
        {leadNav.length > 0 && renderNavSection('Workflow', leadNav, mainNav.reduce((a, s) => a + s.items.length, 0), collapsed)}

        {/* Admin section — visible to any role with at least one admin module */}
        {adminNav.length > 0 && renderNavSection('Admin', adminNav, mainNav.reduce((a, s) => a + s.items.length, 0) + leadNav.length, collapsed)}

        {/* Settings — all roles */}
        {renderNavSection('Account', settingsNav, mainNav.reduce((a, s) => a + s.items.length, 0) + leadNav.length + adminNav.length, collapsed)}
      </nav>

      {/* ── User card ── */}
      <div
        className="relative z-10 p-3 border-t"
        style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.1)' }}
      >
        {!collapsed ? (
          <div
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="relative flex-shrink-0">
              <div style={{ padding: '2px', background: 'rgba(252,211,77,0.4)', borderRadius: '50%' }}>
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                  alt=""
                  className="w-8 h-8 rounded-full bg-slate-800 block"
                />
              </div>
              <span className="online-indicator" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs font-semibold text-white truncate leading-none">
                {user?.name}
              </div>
              <div
                className="text-xs font-medium capitalize mt-0.5 truncate"
                style={{ color: '#FCD34D' }}
              >
                {formatRole(user?.role || '')}
              </div>
              <div className="mt-1">
                <OrgSwitcher />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="relative">
              <div style={{ padding: '2px', background: 'rgba(252,211,77,0.4)', borderRadius: '50%' }}>
                <img
                  src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                  alt=""
                  className="w-8 h-8 rounded-full bg-slate-800 block"
                  title={user?.name}
                />
              </div>
              <span className="online-indicator" />
            </div>
          </div>
        )}
      </div>

      {/* ── Collapse toggle ── */}
      <button
        onClick={onToggle}
        className="absolute -right-3.5 top-[4.5rem] w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 z-50 bg-white hover:bg-[#F59E0B] hover:text-white"
        style={{
          border: '1.5px solid rgba(252,211,77,0.6)',
          boxShadow: '0 2px 12px rgba(30,27,75,0.3)',
          color: '#F59E0B',
          transition: 'all 0.2s ease',
        }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </aside>
  );
}
