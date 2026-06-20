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

const PLAN_LIMITS: Record<string, { users: number | string; storage: string }> = {
  free:       { users: 5,         storage: '1 GB' },
  pro:        { users: 25,        storage: '50 GB' },
  enterprise: { users: 'Unlimited', storage: 'Unlimited' },
};

export default function OrgSettings() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ userCount: number; storageUsed: number } | null>(null);

  useEffect(() => {
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

  const plan = (user as any)?.org_plan ?? 'free';
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

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
              <p className="text-xs text-slate-400">of {limits.users} allowed</p>
              {typeof limits.users === 'number' && (
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
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
              <p className="text-xs text-slate-400">of {limits.storage} allowed</p>
              {plan !== 'enterprise' && (
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.min(100, (stats.storageUsed / (plan === 'pro' ? 50 * 1024 ** 3 : 1 * 1024 ** 3)) * 100)}%` }}
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
