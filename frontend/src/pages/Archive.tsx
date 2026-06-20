import { useState, useEffect } from 'react';
import { Loader2, Filter, RotateCcw, Trash2, Archive as ArchiveIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';
import ConfirmModal from '../components/UI/ConfirmModal';
import { useAuth } from '../context/AuthContext';

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function Archive() {
  const { isAdmin } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const load = (overrides?: { search?: string }) => {
    setLoading(true);
    const params: any = { status: 'archived' };
    const effectiveSearch = overrides && 'search' in overrides ? overrides.search : search;
    if (effectiveSearch) params.search = effectiveSearch;
    api.get('/files', { params })
      .then(r => setFiles(r.data))
      .catch(() => toast.error('Failed to load archived files'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const doRestore = async (id: number) => {
    try {
      await api.post(`/files/${id}/restore`);
      toast.success('File restored to draft');
      load();
    } catch {
      toast.error('Failed to restore file');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete.id) return;
    setActionLoading(true);
    try {
      await api.delete(`/files/${confirmDelete.id}`);
      toast.success('File permanently deleted');
      setConfirmDelete({ open: false, id: null, name: '' });
      load();
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = files.filter(f => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      f.name?.toLowerCase().includes(q) ||
      f.original_name?.toLowerCase().includes(q) ||
      f.project?.toLowerCase().includes(q) ||
      f.category?.toLowerCase().includes(q) ||
      f.owner_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Archive</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">All archived files</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-slate-400" />
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, project, owner…"
            aria-label="Search archived files"
            className="input h-8 text-sm w-64"
          />
          <button type="submit" className="btn-primary py-1.5 px-3 text-sm">Search</button>
        </form>
        <button
          onClick={() => { setSearch(''); load({ search: '' }); }}
          className="btn-ghost text-sm py-1.5"
        >
          Clear
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-amber-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <ArchiveIcon size={36} className="opacity-30" />
            <p className="text-sm font-medium">No archived files</p>
            <p className="text-xs text-slate-400">Files you archive will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-table>
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['File', 'Original Name', 'Project', 'Category', 'Version', 'Owner', 'Size', 'Archived', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((f, index) => (
                  <tr
                    key={f.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${index * 0.03}s` }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[200px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={f.name}>{f.name}</div>
                          <StatusBadge status={f.status} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[160px] truncate" title={f.original_name}>{f.original_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{f.project || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{f.category || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 font-mono">v{f.version}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.owner_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => doRestore(f.id)}
                          title="Restore"
                          aria-label="Restore file"
                          className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"
                        >
                          <RotateCcw size={14} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmDelete({ open: true, id: f.id, name: f.name })}
                            title="Delete permanently"
                            aria-label="Delete file permanently"
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete File"
        message={`"${confirmDelete.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={actionLoading}
      />
    </div>
  );
}
