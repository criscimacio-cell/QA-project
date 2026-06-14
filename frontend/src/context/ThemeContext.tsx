import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // On mount, fetch user preferences and apply saved theme
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    api.get('/users/me').then(r => {
      const savedTheme = r.data?.preferences?.theme;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setDark(savedTheme === 'dark');
      }
    }).catch(() => {});
  }, []);

  const toggle = () => {
    setDark(d => {
      const next = !d;
      // Persist to user profile
      const token = localStorage.getItem('token');
      if (token) {
        api.patch('/users/me/preferences', { preferences: { theme: next ? 'dark' : 'light' } }).catch(() => {});
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
