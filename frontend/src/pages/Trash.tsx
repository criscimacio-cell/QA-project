import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Files } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import EmptyState from '../components/UI/EmptyState';
import ConfirmModal from '../components/UI/ConfirmModal';

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function Trash() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/files/trash');
      setFiles(Array.isArray(r.data) ? r.data : (r.data.files ?? []));
    } catch {
      toast.error('Failed to load trash');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doRestore = async (id: number) => {
    try {
      await api.post(`/files/${id}/restore-from-trash`);
      toast.success('File restored to drafts');
      load();
    } catch {
      toast.error('Failed to restore file');
    }
  };

  const doDelete = async () => {
    if (!confirmDelete.id) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/files/${confirmDelete.id}`);
      toast.success('File permanently deleted');
      setConfirmDelete({ open: false, id: null, name: '' });
      load();
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Trash</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Files are permanently deleted after 30 days</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
          <Trash2 size={15} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{files.length} in trash</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Files size={28} className="text-slate-500 dark:text-slate-400" />}
              title="Trash is empty"
              description="Deleted files will appear here for 30 days before being permanently removed."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['File', 'Owner', 'Size', 'Deleted', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[240px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{f.original_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.owner_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(f.deleted_at).toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => doRestore(f.id)}
                          title="Restore"
                          className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ open: true, id: f.id, name: f.name })}
                          title="Delete permanently"
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

      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={doDelete}
        title="Permanently Delete File"
        message={`"${confirmDelete.name}" will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete permanently"
        loading={deleteLoading}
      />
    </div>
  );
}
