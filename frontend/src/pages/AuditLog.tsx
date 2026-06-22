import { useState, useEffect } from 'react';
import { ShieldCheck, Download, Filter, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import Pagination from '../components/UI/Pagination';

const ACTION_STYLES: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  LOGOUT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  UPLOAD: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DOWNLOAD: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  APPROVE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  ARCHIVE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  USER_CREATE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PERMISSION_CHANGE: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  SEARCH: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  VIEW: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
  FILE_UPDATE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  REPO_CREATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD', 'DELETE', 'APPROVE', 'ARCHIVE', 'USER_CREATE', 'PERMISSION_CHANGE', 'SEARCH'];

/** S2: Sanitize a CSV cell value to prevent CSV injection.
 *  Prefixes any value starting with =, +, -, or @ with a single quote. */
function sanitizeCsvField(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/audit', { params: { action: action || undefined, offset, limit } })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => toast.error('Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [action, offset]);

  // S1: Fetch ALL records (limit=10000) instead of only the current page
  const exportCSV = async () => {
    setExporting(true);
    try {
      let allLogs: any[];
      try {
        const r = await api.get('/audit', { params: { action: action || undefined, offset: 0, limit: 10000 } });
        allLogs = r.data.logs;
      } catch {
        // If the bulk fetch fails, fall back to current page with a warning
        toast.warning('Export contains current page only. Use filters to narrow results first.');
        allLogs = logs;
      }

      const header = 'Timestamp,User,Role,Action,Entity,Details,IP\n';
      // S2: Sanitize details, user_name, ip_address to prevent CSV injection
      const rows = allLogs.map(l => {
        const userName = sanitizeCsvField(String(l.user_name ?? 'System'));
        const details = sanitizeCsvField(String(l.details ?? ''));
        const ipAddress = sanitizeCsvField(String(l.ip_address ?? ''));
        return `"${l.created_at}","${userName}","${l.user_role ?? ''}","${l.action}","${l.entity_type}","${details}","${ipAddress}"`;
      }).join('\n');

      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
      URL.revokeObjectURL(url);
      // U3: Confirm success
      toast.success('CSV exported');
    } finally {
      setExporting(false);
    }
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
        {/* U3: Disable and show spinner while exporting */}
        <button onClick={exportCSV} disabled={exporting} className="btn-secondary">
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Summary — U1: Show shimmer skeletons while loading */}
      <div className="grid grid-cols-5 gap-3">
        {summaryActions.map((sa, i) => (
          <div key={sa} className="card p-3 text-center">
            {loading ? (
              <>
                <div className="shimmer-bg rounded h-7 w-10 mx-auto mb-1" />
                <div className="shimmer-bg rounded-full h-4 w-16 mx-auto" />
              </>
            ) : (
              <>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{summary[i].count}</div>
                <div className={`text-xs mt-0.5 font-medium px-2 py-0.5 rounded-full inline-block ${ACTION_STYLES[sa] || 'bg-slate-100 text-slate-600'}`}>{sa}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">pg {Math.floor(offset / limit) + 1}</div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Filters — L4: page resets to 1 when action filter changes */}
      <div className="card p-4 flex gap-3 items-center flex-wrap">
        <Filter size={16} className="text-slate-400" />
        <select value={action} onChange={e => { setAction(e.target.value); setOffset(0); }} className="input h-8 text-sm w-44">
          <option value="">All Actions</option>
          {ACTIONS.slice(1).map(a => <option key={a}>{a}</option>)}
        </select>
        <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto">Total: {total} events</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
            ))}
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
                {logs.map((l, index) => (
                  <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50" style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${index * 0.03}s`, transition: 'background 0.15s ease' }}>
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
                  <tr>
                    <td colSpan={7} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ShieldCheck size={32} className="text-slate-300 dark:text-slate-600" />
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No audit events found</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Try adjusting the filter or come back later</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Pagination total={total} limit={limit} offset={offset} onPageChange={o => { setOffset(o); }} />
        </div>
      </div>
    </div>
  );
}
