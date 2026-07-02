import { useState, useEffect } from 'react';
import { Lock, Files } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import EmptyState from '../components/UI/EmptyState';

export default function CheckedOut() {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/files/checked-out')
      .then(r => setFiles(Array.isArray(r.data) ? r.data : (r.data.files ?? [])))
      .catch(() => toast.error('Failed to load checked-out files'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Checked Out Files</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Files currently locked for editing</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800">
          <Lock size={15} className="text-slate-500 dark:text-slate-400" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{files.length} checked out</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Files size={28} className="text-slate-500 dark:text-slate-400" />}
              title="No files currently checked out"
              description="When users check out files for editing, they will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['File', 'Project', 'Category', 'Checked Out By', 'Since'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{f.original_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.project || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.category || '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 font-medium">{f.checked_out_by_name}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{new Date(f.checked_out_at).toLocaleDateString('en-CA')}</td>
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
