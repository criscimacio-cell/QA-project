import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

export type ModuleKey = 'dashboard' | 'repositories' | 'files' | 'search' | 'knowledge' | 'testData' | 'approvals' | 'archive' | 'audit' | 'users' | 'settings' | 'orgSettings';

export type RolePermissions = Record<string, Record<ModuleKey, boolean>>;

const DEFAULT_PERMISSIONS: RolePermissions = {
  admin:    { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: true, archive: true, audit: true, users: true, settings: true, orgSettings: true },
  lead:     { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: true, archive: true, audit: false, users: false, settings: true, orgSettings: false },
  engineer: { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: false, archive: false, audit: false, users: false, settings: true, orgSettings: false },
  viewer:   { dashboard: true, repositories: true, files: true, search: true, knowledge: true, testData: true, approvals: false, archive: false, audit: false, users: false, settings: true, orgSettings: false },
};

interface PermissionsContextType {
  permissions: RolePermissions;
  loading: boolean;
  canAccess: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: DEFAULT_PERMISSIONS,
  loading: false,
  canAccess: () => true,
  refresh: async () => {},
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await api.get('/org-settings/permissions');
      setPermissions(r.data);
    } catch {
      setPermissions(DEFAULT_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const canAccess = useCallback((module: ModuleKey): boolean => {
    if (!user) return false;
    const rolePerms = permissions[user.role];
    if (!rolePerms) return false;
    return rolePerms[module] ?? true;
  }, [user, permissions]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, canAccess, refresh: fetch }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
