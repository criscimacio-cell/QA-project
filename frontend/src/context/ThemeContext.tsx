import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../api/client';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  dark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, mode: 'system', setMode: () => {}, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => (localStorage.getItem('themeMode') as ThemeMode) || 'system');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Listen to OS preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // On mount, fetch user preferences and apply saved theme mode
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    api.get('/users/me').then(r => {
      const savedMode = r.data?.preferences?.themeMode as ThemeMode;
      if (savedMode === 'dark' || savedMode === 'light' || savedMode === 'system') {
        setModeState(savedMode);
        localStorage.setItem('themeMode', savedMode);
      }
    }).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    localStorage.setItem('themeMode', m);
    const token = localStorage.getItem('token');
    if (token) {
      api.patch('/users/me/preferences', { preferences: { themeMode: m } }).catch(() => {});
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(dark ? 'light' : 'dark');
  }, [dark, setMode]);

  return (
    <ThemeContext.Provider value={{ dark, mode, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
