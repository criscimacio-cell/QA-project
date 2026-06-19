import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api/client';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'lead' | 'engineer' | 'viewer';
  department: string;
  avatar: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isLead: boolean;
  isEngineer: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Cookie is sent automatically; just verify the session is valid
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
  };

  const refreshUser = async () => {
    const r = await api.get('/auth/me');
    setUser(r.data);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {});
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user, loading, login, logout, refreshUser,
      isAdmin: user?.role === 'admin',
      isLead: user?.role === 'lead' || user?.role === 'admin',
      isEngineer: ['admin', 'lead', 'engineer'].includes(user?.role || ''),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
