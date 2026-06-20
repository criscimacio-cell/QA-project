import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../api/client';

interface CrossOrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  org_name: string;
  org_id: string;
  active: boolean;
  last_login: string | null;
  created_at: string;
}

export default function BackofficeUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<CrossOrgUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchUsers = (s: string, o: string) => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (s) params.search = s;
    if (o) params.org_id = o;
    api.get('/backoffice/users', { params })
      .then(res => {
        const data = res.data;
        if (Array.isArray(data)) {
          setUsers(data);
          setTotal(data.length);
        } else {
          setUsers(data.users ?? []);
          setTotal(data.total ?? 0);
        }
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchUsers(search, orgId), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, orgId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Users</h1>
        <p className="text-slate-500 text-sm mt-0.5">Cross-organization user directory — {total} user{total !== 1 ? 's' : ''}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-xs text-slate-500 px-1">Filter by Org ID</label>
          <input
            type="text"
            placeholder="Organization ID…"
            value={orgId}
            onChange={e => setOrgId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
          />
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-800 bg-slate-900/80">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Organization</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Last Login</th>
                  <th className="text-right px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">{user.name}</td>
                    <td className="px-4 py-3 text-slate-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 capitalize">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/backoffice/organizations/${user.org_id}`)}
                        className="text-slate-300 hover:text-indigo-400 transition-colors text-left"
                      >
                        {user.org_name}
                      </button>
                      <div className="text-xs text-slate-600 font-mono">{user.org_id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${user.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-500'}`}>
                        {user.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 text-xs">
                      {new Date(user.created_at).toLocaleDateString()}
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
