import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, LogOut, User, ChevronDown, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useLogout } from '../../context/LogoutContext';
import api from '../../api/client';

interface TopBarProps { sidebarWidth: number; }

export default function TopBar({ sidebarWidth }: TopBarProps) {
  const { user } = useAuth();
  const { triggerLogout } = useLogout();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showUser, setShowUser] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/notifications').then(r => {
      setNotifCount(r.data.unread);
      setNotifs(r.data.notifications.slice(0, 5));
    }).catch(() => {});
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const markAllRead = () => {
    api.post('/notifications/read-all').then(() => {
      setNotifCount(0);
      setNotifs(n => n.map(x => ({ ...x, read: 1 })));
    });
  };

  const notifIcons: Record<string, string> = {
    upload: '📤', approval: '✅', review: '👀', version: '🔄', info: 'ℹ️',
  };

  return (
    <header
      className="fixed top-0 right-0 h-16 flex items-center gap-3 px-5 z-[150] transition-all duration-300 topbar-premium"
      style={{ left: sidebarWidth }}
    >
      {/* ── Search ── */}
      <form onSubmit={handleSearch} className="flex-1 max-w-[480px]">
        <div
          className={`relative flex items-center rounded-xl transition-all duration-300 ${
            searchFocused
              ? 'shadow-[0_0_0_2px_rgba(245,158,11,0.35)]'
              : ''
          }`}
          style={{
            background: searchFocused
              ? (dark ? 'rgba(15,23,42,0.9)' : 'rgba(248,250,252,1)')
              : (dark ? 'rgba(30,41,59,0.6)' : 'rgba(248,250,252,0.9)'),
            border: searchFocused
              ? '1px solid rgba(245,158,11,0.4)'
              : (dark ? '1px solid rgba(51,65,85,0.5)' : '1px solid rgba(226,232,240,0.8)'),
            backdropFilter: 'blur(12px)',
          }}
        >
          <Search
            size={15}
            className={`absolute left-3.5 transition-colors duration-200 ${
              searchFocused ? 'text-[#F59E0B]' : 'text-slate-500'
            }`}
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search files, articles, Jira tickets…"
            className="w-full pl-9 pr-9 h-9 bg-transparent rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-500 outline-none transition-all duration-300"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </form>

      {/* ── Right actions ── */}
      <div className="flex items-center gap-1 ml-auto">

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#F59E0B] dark:hover:text-[#FCD34D] transition-all duration-200 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50"
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <div className="transition-all duration-300" style={{ transform: dark ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </div>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="relative w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:text-[#F59E0B] dark:hover:text-[#FCD34D] transition-all duration-200 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50"
            onClick={() => { setShowNotif(s => !s); setShowUser(false); }}
            title="Notifications"
          >
            <Bell size={17} className={notifCount > 0 ? 'text-[#F59E0B]' : ''} />
            {notifCount > 0 && (
              <>
                <span className="notification-badge">{notifCount > 9 ? '9+' : notifCount}</span>
                <span className="notification-pulse-ring" />
              </>
            )}
          </button>

          {showNotif && (
            <div
              className="absolute right-0 top-12 rounded-2xl overflow-hidden z-50 dropdown-menu bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60"
              style={{
                width: '340px',
                boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.12)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-700/50"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(252,211,77,0.04))',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-800 dark:text-white">Notifications</span>
                  {notifCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #F59E0B, #FBBF24)' }}
                    >
                      {notifCount}
                    </span>
                  )}
                </div>
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: '#F59E0B' }}
                >
                  Mark all read
                </button>
              </div>

              {/* Items */}
              <div className="divide-y divide-slate-200 dark:divide-slate-800/60 max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                    <Bell size={28} className="opacity-30" />
                    <span className="text-sm">All caught up!</span>
                  </div>
                ) : notifs.map((n, i) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (n.read) return;
                      await api.post(`/notifications/${n.id}/read`);
                      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                      setNotifCount(c => Math.max(0, c - 1));
                    }}
                    className={`notif-item px-4 py-3 cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/50 ${
                      !n.read ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                    }`}
                    style={{ animation: 'slideInRight 0.25s ease both', animationDelay: `${i * 0.04}s` }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                        style={{
                          background: !n.read
                            ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(252,211,77,0.1))'
                            : 'rgba(100,116,139,0.08)',
                        }}
                      >
                        {notifIcons[n.type] || 'ℹ️'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-100 leading-snug">
                          {n.title}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug line-clamp-2">
                          {n.message}
                        </div>
                        <div className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                          {new Date(n.created_at).toLocaleString()}
                        </div>
                        {/* Age bar */}
                        <div style={{ height: 2, background: 'rgba(245,158,11,0.5)', width: '30%', marginTop: 4 }} />
                      </div>
                      {!n.read && (
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                          style={{ background: '#F59E0B', boxShadow: '0 0 6px rgba(245,158,11,0.5)' }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                className="px-4 py-3 text-center border-t border-slate-200 dark:border-slate-700/50"
              >
                <button
                  onClick={markAllRead}
                  className="text-xs font-medium transition-colors hover:underline"
                  style={{ color: '#F59E0B' }}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700/60 mx-1" />

        {/* User menu */}
        <div className="relative" ref={userRef}>
          <button
            className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl transition-all duration-200 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 hover:border-[#F59E0B]/50"
            onClick={() => { setShowUser(s => !s); setShowNotif(false); }}
          >
            <div className="relative flex-shrink-0">
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt=""
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800"
                style={{ border: '2px solid rgba(245,158,11,0.4)' }}
              />
              <span className="online-indicator" />
            </div>
            <div className="text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-800 dark:text-white leading-none">
                {user?.name?.split(' ')[0]}
              </div>
              <div className="text-xs capitalize leading-none mt-0.5 font-medium" style={{ color: '#F59E0B' }}>
                {user?.role}
              </div>
            </div>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform duration-200 ${showUser ? 'rotate-180' : ''}`}
            />
          </button>

          {showUser && (
            <div
              className="absolute right-0 top-12 w-52 rounded-xl overflow-hidden z-50 dropdown-menu bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60"
              style={{
                boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 40px rgba(0,0,0,0.12)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* User info header */}
              <div
                className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-700/50"
                style={{
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.07), rgba(252,211,77,0.04))',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <img
                      src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                      alt=""
                      className="w-9 h-9 rounded-full bg-slate-200"
                      style={{ border: '2px solid rgba(245,158,11,0.35)' }}
                    />
                    <span className="online-indicator" style={{ width: '9px', height: '9px' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white truncate leading-tight">
                      {user?.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button onClick={() => { setShowUser(false); navigate('/settings'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.1)' }}
                  >
                    <User size={13} style={{ color: '#F59E0B' }} />
                  </div>
                  <span className="font-medium">My Profile</span>
                </button>

                <div className="mx-3 my-1 h-px bg-slate-200 dark:bg-slate-800/60" />

                <button
                  onClick={triggerLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors"
                >
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 bg-red-50 dark:bg-red-900/30">
                    <LogOut size={13} className="text-red-500" />
                  </div>
                  <span className="font-medium">Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
