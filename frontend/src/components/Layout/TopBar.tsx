import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, LogOut, User, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../api/client';

interface TopBarProps { sidebarWidth: number; }

export default function TopBar({ sidebarWidth }: TopBarProps) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showUser, setShowUser] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/notifications').then(r => {
      setNotifCount(r.data.unread);
      setNotifs(r.data.notifications.slice(0, 5));
    }).catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const markAllRead = () => {
    api.post('/notifications/read-all').then(() => { setNotifCount(0); setNotifs(n => n.map(x => ({ ...x, read: 1 }))); });
  };

  const notifIcons: Record<string, string> = { upload: '📤', approval: '✅', review: '👀', version: '🔄', info: 'ℹ️' };

  return (
    <header
      className="fixed top-0 right-0 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center gap-4 px-6 z-30 transition-all duration-300"
      style={{ left: sidebarWidth }}
    >
      {/* Search */}
      <form onSubmit={handleSearch} className="flex-1 max-w-xl">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files, articles, Jira tickets..."
            className="input pl-9 text-sm h-9"
          />
        </div>
      </form>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme */}
        <button onClick={toggle} className="btn-ghost p-2 rounded-lg" title="Toggle theme">
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            className="btn-ghost p-2 rounded-lg relative"
            onClick={() => { setShowNotif(s => !s); setShowUser(false); }}
          >
            <Bell size={18} />
            {notifCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-12 w-80 card shadow-xl animate-slide-in z-50">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
                <span className="font-semibold text-sm">Notifications</span>
                <button onClick={markAllRead} className="text-xs text-primary-500 hover:underline">Mark all read</button>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
                {notifs.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 text-center">No notifications</div>
                ) : notifs.map(n => (
                  <div key={n.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${!n.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}>
                    <div className="flex gap-3">
                      <span className="text-lg">{notifIcons[n.type] || 'ℹ️'}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                      {!n.read && <div className="w-2 h-2 bg-primary-500 rounded-full ml-auto mt-1 flex-shrink-0" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => { setShowUser(s => !s); setShowNotif(false); }}
          >
            <img src={user?.avatar || ''} alt="" className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-none">{user?.name?.split(' ')[0]}</div>
              <div className="text-xs text-primary-500 capitalize leading-none mt-0.5">{user?.role}</div>
            </div>
            <ChevronDown size={14} className="text-gray-400" />
          </button>
          {showUser && (
            <div className="absolute right-0 top-12 w-48 card shadow-xl animate-slide-in z-50 py-1">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</div>
                <div className="text-xs text-gray-500">{user?.email}</div>
              </div>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                <User size={15} /> Profile
              </button>
              <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
