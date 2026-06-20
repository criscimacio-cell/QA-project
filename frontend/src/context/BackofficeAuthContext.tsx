import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

export interface BackofficeUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_login: string | null;
}

interface BackofficeAuthContextValue {
  admin: BackofficeUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

const BackofficeAuthContext = createContext<BackofficeAuthContextValue | null>(null);

export function BackofficeAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<BackofficeUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await api.get('/backoffice/auth/me');
      setAdmin(res.data);
    } catch {
      setAdmin(null);
    }
  };

  useEffect(() => {
    fetchMe().finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    await api.post('/backoffice/auth/login', { email, password });
    const res = await api.get('/backoffice/auth/me');
    setAdmin(res.data);
  };

  const logout = async () => {
    await api.post('/backoffice/auth/logout').catch(() => {});
    setAdmin(null);
  };

  const refreshAdmin = async () => {
    await fetchMe();
  };

  return (
    <BackofficeAuthContext.Provider value={{ admin, loading, isAuthenticated: !!admin, login, logout, refreshAdmin }}>
      {children}
    </BackofficeAuthContext.Provider>
  );
}

export function useBackofficeAuth() {
  const ctx = useContext(BackofficeAuthContext);
  if (!ctx) throw new Error('useBackofficeAuth must be used within BackofficeAuthProvider');
  return ctx;
}
