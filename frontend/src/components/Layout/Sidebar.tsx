import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderOpen, Files, Search, BookOpen,
  Database, GitPullRequest, Users, ShieldCheck, Settings,
  ChevronLeft, ChevronRight, Layers
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clsx from 'clsx';

interface SidebarProps { collapsed: boolean; onToggle: () => void; }

const nav = [
  { section: 'Main', items: [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/repositories', icon: FolderOpen, label: 'Repositories' },
    { to: '/files', icon: Files, label: 'File Manager' },
    { to: '/search', icon: Search, label: 'Search' },
  ]},
  { section: 'Content', items: [
    { to: '/knowledge', icon: BookOpen, label: 'Knowledge Base' },
    { to: '/test-data', icon: Database, label: 'Test Data Library' },
    { to: '/approvals', icon: GitPullRequest, label: 'Approval Workflow' },
  ]},
];

const adminNav = [
  { to: '/users', icon: Users, label: 'User Management' },
  { to: '/audit', icon: ShieldCheck, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, isLead, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className={clsx(
      'fixed left-0 top-0 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 z-40',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0">
          <Layers size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-bold text-sm text-gray-900 dark:text-gray-100">Q-KTAMP</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">QA Asset Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {nav.map(section => (
          <div key={section.section}>
            {!collapsed && (
              <div className="px-3 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                {section.section}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => isActive
                    ? clsx('sidebar-link-active', collapsed && 'justify-center px-2')
                    : clsx('sidebar-link', collapsed && 'justify-center px-2')
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}

        {isLead && (
          <div>
            {!collapsed && (
              <div className="px-3 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">
                Admin
              </div>
            )}
            <div className="space-y-0.5">
              {adminNav.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => isActive
                    ? clsx('sidebar-link-active', collapsed && 'justify-center px-2')
                    : clsx('sidebar-link', collapsed && 'justify-center px-2')
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon size={18} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer" onClick={logout}>
            <img src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="" className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user?.name}</div>
              <div className="text-xs text-primary-500 capitalize">{user?.role}</div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="" className="w-8 h-8 rounded-full bg-gray-200 cursor-pointer" onClick={logout} />
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
