import { useEffect, useState } from 'react';
import { Building2, Users, HardDrive, Package, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { toast } from 'sonner';
import { formatBytes } from '../utils/format';


const PLAN_LIMITS: Record<string, { users: number; usersLabel: string; storageBytes: number; storageLabel: string }> = {
  free:       { users: 5,         usersLabel: '5',         storageBytes: 1 * 1024 ** 3,  storageLabel: '1 GB' },
  pro:        { users: 25,        usersLabel: '25',        storageBytes: 50 * 1024 ** 3, storageLabel: '50 GB' },
  enterprise: { users: Infinity,  usersLabel: 'Unlimited', storageBytes: Infinity,        storageLabel: 'Unlimited' },
};

const VALID_PLANS = Object.keys(PLAN_LIMITS);

export default function OrgSettings() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<{ userCount: number; storageUsed: number } | null>(null);
  const [retentionDays, setRetentionDays] = useState<string>('');
  const [retentionEnabled, setRetentionEnabled] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const isAdmin = (user as any)?.role === 'admin';

  useEffect(() => {
    refreshUser();
    Promise.all([
      api.get('/users'),
      api.get('/dashboard/stats'),
    ]).then(([usersRes, statsRes]) => {
      setStats({
        userCount: usersRes.data.total ?? usersRes.data.users?.length ?? usersRes.data.length ?? 0,
        storageUsed: statsRes.data.totalStorage ?? 0,
      });
    }).catch(() => {});

    if (isAdmin) {
      api.get('/org-settings/retention').then(r => {
        if (r.data.retention_days) {
          setRetentionEnabled(true);
          setRetentionDays(String(r.data.retention_days));
        }
      }).catch(() => {});
    }
  }, []);

  const saveRetention = async () => {
    setRetentionSaving(true);
    try {
      const body = retentionEnabled ? { retention_days: parseInt(retentionDays) || null } : { retention_days: null };
      await api.put('/org-settings/retention', body);
      toast.success('Retention policy saved');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Failed to save retention policy');
    } finally {
      setRetentionSaving(false);
    }
  };

  const rawPlan = (user as any)?.org_plan;
  const plan = rawPlan && VALID_PLANS.includes(rawPlan) ? rawPlan : 'free';
  const limits = PLAN_LIMITS[plan];

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organization</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Your workspace details and current plan usage</p>
      </div>

      {/* Org identity */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Building2 size={15} /> Organization Info
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-1">Name</p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{(user as any)?.org_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Organization ID (slug)</p>
            <p className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300 inline-block">
              {(user as any)?.org_slug ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Package size={15} /> Plan
        </h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
            plan === 'enterprise' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
            plan === 'pro'        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>{plan}</span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            To upgrade, contact your platform administrator.
          </span>
        </div>

        {stats && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Users */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <Users size={13} /> Users
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.userCount}</p>
              <p className="text-xs text-slate-400">of {limits.usersLabel} allowed</p>
              {isFinite(limits.users) && (
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.userCount / limits.users >= 0.9 ? 'bg-red-500' : stats.userCount / limits.users >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (stats.userCount / limits.users) * 100)}%` }}
                  />
                </div>
              )}
            </div>

            {/* Storage */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <HardDrive size={13} /> Storage
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatBytes(stats.storageUsed)}</p>
              <p className="text-xs text-slate-400">of {limits.storageLabel} allowed</p>
              {isFinite(limits.storageBytes) && (
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stats.storageUsed / limits.storageBytes >= 0.9 ? 'bg-red-500' : stats.storageUsed / limits.storageBytes >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, (stats.storageUsed / limits.storageBytes) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Data Retention (admin only) */}
      {isAdmin && (
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
            <Clock size={15} /> Data Retention Policy
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Automatically archive files that haven't been updated within the retention window. Archived files remain accessible but won't appear in active views.
          </p>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={retentionEnabled} onChange={e => setRetentionEnabled(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Enable automatic archiving</span>
          </label>
          {retentionEnabled && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-600 dark:text-slate-400 shrink-0">Archive files older than</label>
              <input
                type="number"
                min={1} max={3650}
                value={retentionDays}
                onChange={e => setRetentionDays(e.target.value)}
                className="input w-24"
                placeholder="90"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">days</span>
            </div>
          )}
          <button onClick={saveRetention} disabled={retentionSaving || (retentionEnabled && !retentionDays)} className="btn-primary">
            {retentionSaving ? 'Saving…' : 'Save Retention Policy'}
          </button>
        </div>
      )}
    </div>
  );
}
