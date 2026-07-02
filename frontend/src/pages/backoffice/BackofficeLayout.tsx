import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, LogOut, Shield, Sun, Moon } from 'lucide-react';
import { useBackofficeAuth } from '../../context/BackofficeAuthContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

const navItems = [
  { to: '/backoffice', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/backoffice/organizations', label: 'Organizations', icon: Building2, end: false },
  { to: '/backoffice/users', label: 'Users', icon: Users, end: false },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums">
      {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
      {' · '}
      {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

export default function BackofficeLayout() {
  const { admin, loading, isAuthenticated, logout } = useBackofficeAuth();
  const { dark, setMode } = useTheme();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('Logout failed');
    }
  };

  const toggleTheme = () => setMode(dark ? 'light' : 'dark');

  const bg = dark ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-slate-800';
  const sidebar = dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200';
  const topbar = dark ? 'border-slate-800 bg-slate-900/50' : 'border-gray-200 bg-white';
  const footer = dark ? 'border-slate-800 bg-slate-900/30' : 'border-gray-200 bg-white';
  const navInactive = dark ? 'text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-gray-100';
  const adminName = dark ? 'text-slate-500 dark:text-slate-400' : 'text-slate-600';
  const adminEmail = dark ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400';
  const logoBrand = dark ? 'text-white' : 'text-slate-800';
  const logoSub = dark ? 'text-slate-500' : 'text-slate-500 dark:text-slate-400';
  const topbarLabel = dark ? 'text-slate-500 dark:text-slate-400' : 'text-slate-500';
  const topbarName = dark ? 'text-slate-200' : 'text-slate-800';
  const iconBtn = dark ? 'text-slate-500 dark:text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-gray-100';
  const footerText = dark ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400';

  return (
    <div className={`min-h-screen flex ${bg}`}>
      {/* Sidebar */}
      <aside className={`w-60 flex-shrink-0 border-r flex flex-col ${sidebar}`}>
        {/* Logo */}
        <div className={`px-5 py-5 border-b ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className={`font-bold text-sm ${logoBrand}`}>Qlarity</span>
              <span className={`block text-xs leading-none ${logoSub}`}>Admin Console</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                    : navInactive
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom admin info */}
        <div className={`px-4 py-4 border-t ${dark ? 'border-slate-800' : 'border-gray-200'}`}>
          <div className={`text-xs font-medium truncate mb-0.5 ${adminName}`}>{admin?.name}</div>
          <div className={`text-xs truncate ${adminEmail}`}>{admin?.email}</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className={`h-14 flex items-center justify-between px-6 border-b flex-shrink-0 ${topbar}`}>
          <div className={`text-sm ${topbarLabel}`}>
            Logged in as <span className={`font-medium ${topbarName}`}>{admin?.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`p-1.5 rounded-lg transition-colors ${iconBtn}`}
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded-lg ${iconBtn}`}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className={`flex-shrink-0 px-6 py-2.5 border-t flex items-center justify-between ${footer}`}>
          <span className={`text-xs ${footerText}`}><Clock /></span>
          <span className={`text-xs ${footerText}`}>Qlarity Admin Console</span>
        </footer>
      </div>
    </div>
  );
}
