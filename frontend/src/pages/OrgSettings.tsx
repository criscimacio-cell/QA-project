import { useEffect, useState } from 'react';
import { Building2, Users, HardDrive, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

function formatBytes(b: number) {
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(1) + ' GB';
  if (b >= 1024 ** 2) return (b / 1024 ** 2).toFixed(1) + ' MB';
  if (b >= 1024) return (b / 1024).toFixed(1) + ' KB';
  return b + ' B';
}

const PLAN_LIMITS: Record<string, { users: number; usersLabel: string; storageBytes: number; storageLabel: string }> = {
  free:       { users: 5,         usersLabel: '5',         storageBytes: 1 * 1024 ** 3,  storageLabel: '1 GB' },
  pro:        { users: 25,        usersLabel: '25',        storageBytes: 50 * 1024 ** 3, storageLabel: '50 GB' },
  enterprise: { users: Infinity,  usersLabel: 'Unlimited', storageBytes: Infinity,        storageLabel: 'Unlimited' },
};

const VALID_PLANS = Object.keys(PLAN_LIMITS);

export default function OrgSettings() {
  const { user, refreshUser } = useAuth();
  const [stats, setStats] = useState<{ userCount: number; storageUsed: number } | null>(null);

  useEffect(() => {
    refreshUser();
    Promise.all([
      api.get('/users'),
      api.get('/dashboard/stats'),
    ]).then(([usersRes, statsRes]) => {
      setStats({
        userCount: usersRes.data.length,
        storageUsed: statsRes.data.totalStorage ?? 0,
      });
    }).catch(() => {});
  }, []);

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
    </div>
  );
}
