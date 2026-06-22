import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

export type ModuleKey = 'dashboard' | 'repositories' | 'files' | 'search' | 'knowledge' | 'testData' | 'approvals' | 'archive' | 'audit' | 'users' | 'settings' | 'orgSettings';

export type RolePermissions = Record<string, Record<ModuleKey, boolean>>;

// What each hardcoded role can see by default — these never change via the DB
const HARDCODED_ROLE_PERMISSIONS: RolePermissions = {
  admin:    { dashboard: true,  repositories: true,  files: true,  search: true,  knowledge: true,  testData: true,  approvals: true,  archive: true,  audit: true,  users: true,  settings: true,  orgSettings: true },
  lead:     { dashboard: true,  repositories: true,  files: true,  search: true,  knowledge: true,  testData: true,  approvals: true,  archive: true,  audit: false, users: false, settings: true,  orgSettings: false },
  engineer: { dashboard: true,  repositories: true,  files: true,  search: true,  knowledge: true,  testData: true,  approvals: false, archive: false, audit: false, users: false, settings: true,  orgSettings: false },
  viewer:   { dashboard: true,  repositories: true,  files: true,  search: true,  knowledge: true,  testData: true,  approvals: false, archive: false, audit: false, users: false, settings: true,  orgSettings: false },
};

const DEFAULT_PERMISSIONS: RolePermissions = { ...HARDCODED_ROLE_PERMISSIONS };

interface PermissionsContextType {
  permissions: RolePermissions;
  loading: boolean;
  canAccess: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
  customRoles: string[];
}

const PermissionsContext = createContext<PermissionsContextType>({
  permissions: DEFAULT_PERMISSIONS,
  loading: false,
  canAccess: () => false,
  refresh: async () => {},
  customRoles: [],
});

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await api.get('/org-settings/permissions');
      // Merge DB permissions (custom roles) with hardcoded defaults
      setPermissions({ ...HARDCODED_ROLE_PERMISSIONS, ...r.data });
    } catch {
      setPermissions(DEFAULT_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchPermissions(); }, [fetchPermissions]);

  const canAccess = useCallback((module: ModuleKey): boolean => {
    if (!user) return false;
    // Hardcoded roles use their built-in permissions
    if (HARDCODED_ROLE_PERMISSIONS[user.role]) {
      return HARDCODED_ROLE_PERMISSIONS[user.role][module] ?? false;
    }
    // Custom roles use DB-fetched permissions
    const rolePerms = permissions[user.role];
    if (!rolePerms) return false;
    return rolePerms[module] ?? false;
  }, [user, permissions]);

  const customRoles = Object.keys(permissions).filter(r => !HARDCODED_ROLE_PERMISSIONS[r]);

  return (
    <PermissionsContext.Provider value={{ permissions, loading, canAccess, refresh: fetchPermissions, customRoles }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionsContext);
