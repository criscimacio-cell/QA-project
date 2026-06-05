import { useState, useEffect } from 'react';
import { ShieldCheck, Download, Filter } from 'lucide-react';
import api from '../api/client';

const ACTION_STYLES: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOGOUT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  UPLOAD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DOWNLOAD: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  APPROVE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ARCHIVE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  USER_CREATE: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  PERMISSION_CHANGE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  SEARCH: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  VIEW: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  FILE_UPDATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  REPO_CREATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'DELETE', 'APPROVE', 'ARCHIVE', 'USER_CREATE', 'PERMISSION_CHANGE', 'SEARCH'];

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/audit', { params: { action: action || undefined, page, limit: 50 } }).then(r => { setLogs(r.data.logs); setTotal(r.data.total); }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [action, page]);

  const exportCSV = () => {
    const header = 'Timestamp,User,Role,Action,Entity,Details,IP\n';
    const rows = logs.map(l => `"${l.created_at}","${l.user_name}","${l.user_role}","${l.action}","${l.entity_type}","${l.details}","${l.ip_address}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
  };

  const summaryActions = ['UPLOAD', 'DOWNLOAD', 'LOGIN', 'DELETE', 'APPROVE'];
  const summary = summaryActions.map(a => ({ action: a, count: logs.filter(l => l.action === a).length }));

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Audit Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Security and compliance event history</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary"><Download size={15} />Export CSV</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-5 gap-3">
        {summary.map(s => (
          <div key={s.action} className="card p-3 text-center">
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.count}</div>
            <div className={`text-xs mt-0.5 font-medium px-2 py-0.5 rounded-full inline-block ${ACTION_STYLES[s.action] || 'bg-slate-100 text-slate-600'}`}>{s.action}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-3 items-center flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="input h-8 text-sm w-44">
          <option value="">All Actions</option>
          {ACTIONS.slice(1).map(a => <option key={a}>{a}</option>)}
        </select>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">Total: {total} events</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-[#08a49c] border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Details', 'IP Address'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{l.user_name || 'System'}</div>
                      <div className="text-xs text-slate-400">{l.user_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-slate-500 dark:text-slate-400">{l.user_role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ACTION_STYLES[l.action] || 'bg-slate-100 text-slate-600'}`}>{l.action}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 capitalize">{l.entity_type}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-[240px] truncate" title={l.details}>{l.details}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{l.ip_address}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No audit events found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex gap-2 justify-center">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm">Previous</button>
          <span className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Page {page}</span>
          <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm">Next</button>
        </div>
      )}
    </div>
  );
}
