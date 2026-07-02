import { useState, useEffect } from 'react';
import { ChevronDown, Building2, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

interface OrgOption {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

export default function OrgSwitcher() {
  const { user, refreshUser } = useAuth();
  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.get('/auth/orgs').then(r => setOrgs(r.data)).catch(() => {});
  }, []);

  if (orgs.length <= 1) return null;

  const switchOrg = async (orgId: string) => {
    if (switching) return;
    setSwitching(true);
    try {
      await api.post('/auth/switch-org', { organizationId: orgId });
      await refreshUser();
      setOpen(false);
      toast.success('Switched organization');
      window.location.reload();
    } catch {
      toast.error('Failed to switch organization');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        {user?.org_name || user?.org_slug}
        <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl py-1 w-56">
            <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Organizations</div>
            {orgs.map(org => (
              <button
                key={org.id}
                onClick={() => switchOrg(org.id)}
                disabled={switching}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{org.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{org.role} · {org.plan}</div>
                </div>
                {org.slug === user?.org_slug && <Check className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
