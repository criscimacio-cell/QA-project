import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';

interface Org {
  id: string;
  name: string;
  slug: string;
  plan: string;
  active: boolean;
  user_count: number;
  file_count: number;
  storage_used: number;
  created_at: string;
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
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${styles[plan] ?? styles.free}`}>
      {plan}
    </span>
  );
}

function PlanDropdown({ org, onPlanChange }: { org: Org; onPlanChange: (id: string, plan: string) => void }) {
  const [open, setOpen] = useState(false);
  const plans = ['free', 'pro', 'enterprise'];

  return (
    <div className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
      >
        Plan <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-32">
            {plans.map(p => (
              <button
                key={p}
                onClick={e => { e.stopPropagation(); onPlanChange(org.id, p); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 transition-colors capitalize ${p === org.plan ? 'text-indigo-400' : 'text-slate-300'}`}
              >
                {p} {p === org.plan && '✓'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const emptyForm = { name: '', slug: '', plan: 'free', adminName: '', adminEmail: '', adminPassword: '' };

export default function BackofficeOrganizations() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);

  const fetchOrgs = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (search) params.search = search;
    if (plan) params.plan = plan;
    if (status) params.status = status;
    api.get('/backoffice/organizations', { params })
      .then(res => setOrgs(res.data))
      .catch(() => toast.error('Failed to load organizations'))
      .finally(() => setLoading(false));
  }, [search, plan, status]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  const handleSuspend = async (org: Org) => {
    try {
      if (org.active) {
        await api.put(`/backoffice/organizations/${org.id}/suspend`);
        toast.success(`${org.name} suspended`);
      } else {
        await api.put(`/backoffice/organizations/${org.id}/activate`);
        toast.success(`${org.name} activated`);
      }
      fetchOrgs();
    } catch {
      toast.error('Action failed');
    }
  };

  const handlePlanChange = async (id: string, newPlan: string) => {
    try {
      await api.put(`/backoffice/organizations/${id}/plan`, { plan: newPlan });
      toast.success('Plan updated');
      fetchOrgs();
    } catch {
      toast.error('Failed to update plan');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/backoffice/organizations', createForm);
      toast.success(`Organization "${createForm.name}" created`);
      setShowCreate(false);
      setCreateForm(emptyForm);
      fetchOrgs();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Organizations</h1>
          <p className="text-slate-500 text-sm mt-0.5">{orgs.length} organization{orgs.length !== 1 ? 's' : ''} found</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {/* Create org modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-semibold text-white">Create Organization</h2>
              <button onClick={() => { setShowCreate(false); setCreateForm(emptyForm); }} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Organization Name *</label>
                  <input required value={createForm.name} onChange={e => { const n = e.target.value; setCreateForm(f => ({ ...f, name: n, slug: f.slug || n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })); }} placeholder="Acme Corp" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Slug *</label>
                  <input required value={createForm.slug} onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="acme-corp" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Plan</label>
                <select value={createForm.plan} onChange={e => setCreateForm(f => ({ ...f, plan: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="free">Free</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="border-t border-slate-800 pt-4">
                <p className="text-xs text-slate-500 mb-3">First Admin User (optional)</p>
                <div className="space-y-3">
                  <input value={createForm.adminName} onChange={e => setCreateForm(f => ({ ...f, adminName: e.target.value }))} placeholder="Admin name" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="email" value={createForm.adminEmail} onChange={e => setCreateForm(f => ({ ...f, adminEmail: e.target.value }))} placeholder="admin@example.com" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="password" value={createForm.adminPassword} onChange={e => setCreateForm(f => ({ ...f, adminPassword: e.target.value }))} placeholder="Password (min 8 chars)" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateForm(emptyForm); }} className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {creating ? 'Creating…' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search organizations…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={plan}
          onChange={e => setPlan(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No organizations found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-3 font-medium">Name / Slug</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Users</th>
                  <th className="text-right px-4 py-3 font-medium">Files</th>
                  <th className="text-right px-4 py-3 font-medium">Storage</th>
                  <th className="text-right px-4 py-3 font-medium">Created</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {orgs.map(org => (
                  <tr
                    key={org.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => navigate(`/backoffice/organizations/${org.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200 hover:text-indigo-400 transition-colors">{org.name}</div>
                      <div className="text-xs text-slate-500">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3"><PlanBadge plan={org.plan} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${org.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {org.active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">{org.user_count}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{org.file_count?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatBytes(org.storage_used)}</td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(org.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleSuspend(org)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            org.active
                              ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                              : 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
                          }`}
                        >
                          {org.active ? 'Suspend' : 'Activate'}
                        </button>
                        <PlanDropdown org={org} onPlanChange={handlePlanChange} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}