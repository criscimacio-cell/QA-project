import { useState, useEffect } from 'react';
import { Database, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';

const CATEGORIES = ['All', 'Test Cases', 'Test Data', 'Test Scripts', 'Template', 'Evidence', 'RCA', 'Bug Report', 'Performance'];

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function TestDataLibrary() {
  const [files, setFiles] = useState<any[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState<string[]>([]);

  const load = () => {
    const params: any = { status: 'published' };
    if (category !== 'All') params.category = category;
    if (search) params.search = search;
    if (project) params.project = project;
    api.get('/files', { params })
      .then(r => {
        setFiles(r.data);
        // Derive project list dynamically from results
        const unique = [...new Set(r.data.map((f: any) => f.project).filter(Boolean))] as string[];
        setProjects(unique);
      })
      .catch(() => toast.error('Failed to load test assets'));
  };

  useEffect(() => { load(); }, [category, project]);

  const handleDownload = async (f: any) => {
    try {
      const res = await fetch(`/api/files/${f.id}/download`, { credentials: 'include' });
      if (!res.ok) { toast.error('Download failed — file not found'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.original_name || f.name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Test Data Library</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Reusable test assets, payloads, and templates</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Test Cases', count: files.filter(f => f.category === 'Test Cases').length, gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)' },
          { label: 'Templates', count: files.filter(f => f.category === 'Template').length, gradient: 'linear-gradient(135deg,#10b981,#FBBF24)' },
          { label: 'Test Scripts', count: files.filter(f => f.category === 'Test Scripts').length, gradient: 'linear-gradient(135deg,#FBBF24,#F59E0B)' },
          { label: 'Test Data', count: files.filter(f => f.category === 'Test Data').length, gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: s.gradient }}>
              <Database size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{s.count}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={e => { e.preventDefault(); load(); }} className="relative">
          <label htmlFor="tdl-search" className="sr-only">Search assets</label>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input id="tdl-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" className="input pl-8 text-sm h-8 w-56" />
        </form>
        <select value={project} onChange={e => setProject(e.target.value)} className="input h-8 text-sm w-40">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${category === cat ? 'bg-[#F59E0B] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {files.length === 0 ? (
        <div className="card p-12 text-center">
          <Database size={40} className="mx-auto mb-3 opacity-30 text-slate-400" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No published assets found</p>
          <p className="text-xs mt-1 text-slate-400">Assets must be in "Published" status to appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map(f => (
            <div key={f.id} className="card p-5 hover:shadow-lg hover:border-teal-200 dark:hover:border-teal-800 transition-all group">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FileIcon mimeType={f.mime_type} name={f.original_name} size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate group-hover:text-teal-600 dark:group-hover:text-teal-400" title={f.name}>{f.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{formatBytes(f.size)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={f.status} />
                  {f.category && <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{f.category}</span>}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{f.project}</span>
                  {f.module && <> · {f.module}</>}
                </div>

                {f.jira_ticket && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{f.jira_ticket}</span>
                )}

                {f.tags && (
                  <div className="flex gap-1 flex-wrap">
                    {f.tags.split(',').slice(0, 3).map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                      <span key={t} className="text-xs bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">v{f.version} · {f.owner_name?.split(' ')[0]}</span>
                <button
                  onClick={() => handleDownload(f)}
                  aria-label={`Download ${f.name}`}
                  className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 hover:text-teal-700 font-medium"
                >
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
