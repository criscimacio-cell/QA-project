import { useState, useEffect } from 'react';
import { Database, Download, Search, Tag, Filter } from 'lucide-react';
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

  const load = () => {
    const params: any = { status: 'published' };
    if (category !== 'All') params.category = category;
    if (search) params.search = search;
    if (project) params.project = project;
    api.get('/files', { params }).then(r => setFiles(r.data));
  };

  useEffect(() => { load(); }, [category, project]);

  const projects = ['All Projects', 'PhilHealth', 'Interim', 'ETL', 'Automation'];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Test Data Library</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Reusable test assets, payloads, and templates</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Test Cases', count: files.filter(f => f.category === 'Test Cases').length, color: 'bg-blue-500' },
          { label: 'Templates', count: files.filter(f => f.category === 'Template').length, color: 'bg-green-500' },
          { label: 'Test Scripts', count: files.filter(f => f.category === 'Test Scripts').length, color: 'bg-purple-500' },
          { label: 'Test Data', count: files.filter(f => f.category === 'Test Data').length, color: 'bg-amber-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
              <Database size={18} className="text-white" />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.count}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <form onSubmit={e => { e.preventDefault(); load(); }} className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..." className="input pl-8 text-sm h-8 w-56" />
        </form>
        <select value={project} onChange={e => setProject(e.target.value === 'All Projects' ? '' : e.target.value)} className="input h-8 text-sm w-40">
          {projects.map(p => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${category === cat ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      {files.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <Database size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No published assets found</p>
          <p className="text-xs mt-1">Assets must be in "Published" status to appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {files.map(f => (
            <div key={f.id} className="card p-5 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800 transition-all group">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-shrink-0 mt-0.5">
                  <FileIcon mimeType={f.mime_type} name={f.original_name} size={30} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">{f.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{formatBytes(f.size)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <StatusBadge status={f.status} />
                  {f.category && <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">{f.category}</span>}
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{f.project}</span>
                  {f.module && <> · {f.module}</>}
                </div>

                {f.jira_ticket && (
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{f.jira_ticket}</span>
                )}

                {f.tags && (
                  <div className="flex gap-1 flex-wrap">
                    {f.tags.split(',').slice(0, 3).map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                      <span key={t} className="text-xs bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-xs text-gray-400">v{f.version} · {f.owner_name?.split(' ')[0]}</span>
                <button
                  onClick={() => window.open(`/api/files/${f.id}/download`, '_blank')}
                  className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
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
