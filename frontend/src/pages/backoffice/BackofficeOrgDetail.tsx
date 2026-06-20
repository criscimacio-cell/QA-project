import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  archived_at: string | null;
  created_at: string;
  stats: {
    total_files: number;
    active_files: number;
    kb_articles: number;
    storage_used: number;
  };
  users: OrgUser[];
  recentActivity: ActivityItem[];
}

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  last_login: string | null;
}

interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  user_name: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
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
    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${styles[plan] ?? styles.free}`}>
      {plan}
    </span>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800/60 rounded-lg px-4 py-3">
      <div className="text-xs text-slate-500 mb-0.5">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

export default function BackofficeOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [planOpen, setPlanOpen] = useState(false);

  const fetchOrg = () => {
    setLoading(true);
    api.get(`/api/backoffice/organizations/${id}`)
      .then(res => setOrg(res.data))
      .catch(() => setError('Failed to load organization'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrg(); }, [id]);

  const handleSuspend = async () => {
    if (!org) return;
    try {
      if (org.active) {
        await api.put(`/api/backoffice/organizations/${org.id}/suspend`);
        toast.success('Organization suspended');
      } else {
        await api.put(`/api/backoffice/organizations/${org.id}/activate`);
        toast.success('Organization activated');
      }
      fetchOrg();
    } catch {
      toast.error('Action failed');
    }
  };

  const handlePlanChange = async (newPlan: string) => {
    if (!org) return;
    try {
      await api.put(`/api/backoffice/organizations/${org.id}/plan`, { plan: newPlan });
      toast.success('Plan updated');
      setPlanOpen(false);
      fetchOrg();
    } catch {
      toast.error('Failed to update plan');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !org) return (
    <div className="text-red-400 text-sm">{error || 'Organization not found'}</div>
  );

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/backoffice/organizations')}
          className="mt-0.5 p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white">{org.name}</h1>
            <PlanBadge plan={org.plan} />
            {org.archived_at ? (
              <span className="inline-flex px-2.5 py-1 rounded text-xs font-medium bg-slate-600/20 text-slate-400 border border-slate-600/30">
                Archived {new Date(org.archived_at).toLocaleDateString()}
              </span>
            ) : (
              <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium ${org.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {org.active ? 'Active' : 'Suspended'}
              </span>
            )}
          </div>
          <div className="text-slate-500 text-sm mt-0.5">
            {org.slug} &middot; Created {new Date(org.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSuspend}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              org.active
                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            {org.active ? 'Suspend' : 'Activate'}
          </button>

          <div className="relative">
            <button
              onClick={() => setPlanOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Change Plan <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {planOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPlanOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-36">
                  {['free', 'pro', 'enterprise'].map(p => (
                    <button
                      key={p}
                      onClick={() => handlePlanChange(p)}
                      className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-700 transition-colors capitalize ${p === org.plan ? 'text-indigo-400' : 'text-slate-300'}`}
                    >
                      {p} {p === org.plan && '✓'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {org.stats && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">Statistics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Files" value={org.stats.total_files?.toLocaleString() ?? 0} />
            <StatBox label="Active Files" value={org.stats.active_files?.toLocaleString() ?? 0} />
            <StatBox label="KB Articles" value={org.stats.kb_articles?.toLocaleString() ?? 0} />
            <StatBox label="Storage Used" value={formatBytes(org.stats.storage_used)} />
          </div>
        </div>
      )}

      {/* Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4">Users ({org.users?.length ?? 0})</h2>
        {!org.users?.length ? (
          <div className="text-slate-500 text-sm">No users</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 pr-4 font-medium">Name</th>
                  <th className="text-left py-2 pr-4 font-medium">Email</th>
                  <th className="text-left py-2 pr-4 font-medium">Role</th>
                  <th className="text-left py-2 pr-4 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Last Login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {org.users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 pr-4 font-medium text-slate-200">{user.name}</td>
                    <td className="py-2.5 pr-4 text-slate-400">{user.email}</td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${user.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-500 text-xs">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-4">Recent Activity</h2>
        {!org.recentActivity?.length ? (
          <div className="text-slate-500 text-sm">No recent activity</div>
        ) : (
          <div className="space-y-2">
            {org.recentActivity.map(item => (
              <div key={item.id} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono bg-slate-800 text-indigo-400 px-1.5 py-0.5 rounded">
                      {item.action}
                    </span>
                    <span className="text-xs text-slate-500">{item.entity_type}</span>
                    <span className="text-xs text-slate-400">by <span className="text-slate-300">{item.user_name}</span></span>
                  </div>
                  {item.details && Object.keys(item.details).length > 0 && (
                    <div className="mt-1 text-xs text-slate-600 font-mono truncate">
                      {JSON.stringify(item.details)}
                    </div>
                  )}
                </div>
                <div className="text-xs text-slate-600 flex-shrink-0">
                  {new Date(item.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
