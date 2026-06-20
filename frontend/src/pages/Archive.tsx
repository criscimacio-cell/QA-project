import { useState, useEffect } from 'react';
import { RotateCcw, Trash2, Archive as ArchiveIcon, Files, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import Modal from '../components/UI/Modal';
import ConfirmModal from '../components/UI/ConfirmModal';
import EmptyState from '../components/UI/EmptyState';

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function Archive() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [confirmRestore, setConfirmRestore] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/files', { params: { status: 'archived' } });
      setFiles(r.data);
    } catch {
      toast.error('Failed to load archived files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doRestore = async () => {
    if (!confirmRestore.id) return;
    setRestoreLoading(true);
    try {
      await api.post(`/files/${confirmRestore.id}/restore`);
      setFiles(prev => prev.filter(f => f.id !== confirmRestore.id));
      setConfirmRestore({ open: false, id: null, name: '' });
      setRestoreSuccess(true);
    } catch {
      toast.error('Failed to restore file');
    } finally {
      setRestoreLoading(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete.id) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/files/${confirmDelete.id}`);
      toast.success('File permanently deleted');
      setFiles(prev => prev.filter(f => f.id !== confirmDelete.id));
      setConfirmDelete({ open: false, id: null, name: '' });
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtered = files.filter(f =>
    !search ||
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.original_name.toLowerCase().includes(search.toLowerCase()) ||
    (f.owner_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Archive</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">All archived files — restore or permanently delete</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
          <ArchiveIcon size={15} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{files.length} archived</span>
        </div>
      </div>

      <div className="card p-4 flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, original file, or owner…"
          className="input h-8 text-sm w-72"
        />
        {search && (
          <button onClick={() => setSearch('')} className="btn-ghost text-sm py-1.5">Clear</button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Files size={28} className="text-slate-400" />}
              title={search ? 'No archived files match your search' : 'No archived files'}
              description={search ? 'Try a different search term.' : 'Files that are archived will appear here.'}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['File', 'Project', 'Category', 'Version', 'Owner', 'Size', 'Archived', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((f, index) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50" style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${index * 0.03}s` }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate" title={f.name}>{f.name}</div>
                          <div className="text-xs text-slate-400 truncate" title={f.original_name}>{f.original_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.project || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.category || '—'}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 font-mono">v{f.version}</span></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.owner_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setConfirmRestore({ open: true, id: f.id, name: f.name })}
                          title="Restore to draft"
                          className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, id: f.id, name: f.name })}
                          title="Permanently delete"
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Restore Modal */}
      <Modal open={confirmRestore.open} onClose={() => setConfirmRestore({ open: false, id: null, name: '' })} title="Restore File" size="md">
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
            <RotateCcw size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              <strong>"{confirmRestore.name}"</strong> will be restored and moved back to Draft status in File Manager.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={doRestore} disabled={restoreLoading} className="btn-primary w-full justify-center flex items-center gap-1.5">
              {restoreLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RotateCcw size={14} />}
              Restore
            </button>
            <button onClick={() => setConfirmRestore({ open: false, id: null, name: '' })} disabled={restoreLoading} className="btn-secondary w-full justify-center">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Restore Success Modal */}
      <Modal open={restoreSuccess} onClose={() => setRestoreSuccess(false)} title="File Restored" size="md">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
              The file has been restored successfully and is now available in <span className="font-semibold text-slate-800 dark:text-slate-100">File Manager</span> as a Draft.
            </p>
          </div>
          <div className="flex justify-center">
            <button onClick={() => setRestoreSuccess(false)} className="btn-primary px-8">Done</button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={doDelete}
        title="Permanently Delete File"
        message={`"${confirmDelete.name}" will be permanently deleted and cannot be recovered. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={deleteLoading}
      />
    </div>
  );
}
