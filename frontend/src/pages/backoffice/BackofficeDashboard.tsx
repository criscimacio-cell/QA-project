import { useEffect, useState } from 'react';
import { Building2, Users, FileText, HardDrive, TrendingUp, Calendar } from 'lucide-react';
import api from '../../api/client';

interface Stats {
  totalOrgs: number;
  activeOrgs: number;
  totalUsers: number;
  totalFiles: number;
  totalStorage: number;
  orgsThisMonth: number;
  recentOrgs: RecentOrg[];
  orgGrowth: GrowthPoint[];
}

interface RecentOrg {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  user_count: number;
  created_at: string;
}

interface GrowthPoint {
  month: string;
  count: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    free: 'bg-slate-700 text-slate-300',
    pro: 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30',
    enterprise: 'bg-violet-600/20 text-violet-400 border border-violet-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${styles[plan] ?? styles.free}`}>
      {plan}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string | number; icon: any; sub?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

function GrowthChart({ data }: { data: GrowthPoint[] }) {
  if (!data || data.length === 0) return <div className="text-slate-500 text-sm py-8 text-center">No growth data yet</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500">New orgs per month</span>
        <span className="text-xs font-medium text-indigo-400">{total} total over 6 mo</span>
      </div>
      {/* Y-axis labels + bars */}
      <div className="flex gap-3">
        <div className="flex flex-col justify-between text-right pb-5" style={{ width: 20 }}>
          <span className="text-xs text-slate-600">{max}</span>
          <span className="text-xs text-slate-600">{Math.round(max / 2)}</span>
          <span className="text-xs text-slate-600">0</span>
        </div>
        <div className="flex-1">
          <div className="flex items-end gap-1.5" style={{ height: 80 }}>
            {data.map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div
                  className="w-full bg-indigo-600 rounded-t group-hover:bg-indigo-500 transition-colors"
                  style={{ height: `${Math.max((point.count / max) * 80, 2)}px` }}
                >
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 whitespace-nowrap z-10">
                    {point.count} org{point.count !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {data.map((point, i) => (
              <div key={i} className="flex-1 text-center">
                <span className="text-xs text-slate-500 block truncate">{point.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BackofficeDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/backoffice/stats')
      .then(res => setStats(res.data))
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error) return <div className="text-red-400 text-sm">{error}</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Total Orgs" value={stats.totalOrgs} icon={Building2} />
        <StatCard label="Active Orgs" value={stats.activeOrgs} icon={TrendingUp} sub={`${stats.totalOrgs ? Math.round((stats.activeOrgs / stats.totalOrgs) * 100) : 0}% of total`} />
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} />
        <StatCard label="Total Files" value={stats.totalFiles.toLocaleString()} icon={FileText} />
        <StatCard label="Storage Used" value={formatBytes(stats.totalStorage)} icon={HardDrive} />
        <StatCard label="Orgs This Month" value={stats.orgsThisMonth} icon={Calendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Org growth chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Org Growth</h2>
          <GrowthChart data={stats.orgGrowth} />
        </div>

        {/* Recent orgs */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Recent Organizations</h2>
          {stats.recentOrgs?.length === 0 ? (
            <div className="text-slate-500 text-sm">No organizations yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-4 font-medium">Name / Slug</th>
                    <th className="text-left py-2 pr-4 font-medium">Plan</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-right py-2 pr-4 font-medium">Users</th>
                    <th className="text-right py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {stats.recentOrgs?.map(org => (
                    <tr key={org.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="font-medium text-slate-200">{org.name}</div>
                        <div className="text-xs text-slate-500">{org.slug}</div>
                      </td>
                      <td className="py-2.5 pr-4"><PlanBadge plan={org.plan} /></td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${org.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {org.active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-slate-300">{org.user_count}</td>
                      <td className="py-2.5 text-right text-slate-500 text-xs">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
