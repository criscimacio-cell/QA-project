import { useState, useEffect } from 'react';
import { Filter, Download, Archive, Trash2, Eye, GitBranch, RefreshCw, ChevronDown } from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

const TABS = ['All Files', 'Pending Approval', 'Published', 'Archived'];
const TAB_STATUS: Record<string, string> = { 'Pending Approval': 'submitted', 'Published': 'published', 'Archived': 'archived' };

export default function FileManager() {
  const { isLead } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('All Files');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [approveStatus, setApproveStatus] = useState('approved');
  const [approveComment, setApproveComment] = useState('');
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('');

  const load = () => {
    setLoading(true);
    const params: any = {};
    if (TAB_STATUS[tab]) params.status = TAB_STATUS[tab];
    if (search) params.search = search;
    if (project) params.project = project;
    if (category) params.category = category;
    api.get('/files', { params }).then(r => setFiles(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab, project, category]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const doApprove = async () => {
    if (!selected) return;
    await api.post(`/files/${selected.id}/approve`, { status: approveStatus, comments: approveComment });
    setShowApprove(false); setApproveComment(''); load();
  };

  const doArchive = async (id: number) => {
    await api.post(`/files/${id}/archive`);
    load();
  };

  const openFile = async (f: any) => {
    const r = await api.get(`/files/${f.id}`);
    setSelected(r.data);
  };

  const projects = [...new Set(files.map(f => f.project).filter(Boolean))];
  const categories = [...new Set(files.map(f => f.category).filter(Boolean))];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">File Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all QA files and assets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400" />
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, tags, Jira..." className="input h-8 text-sm w-64" />
          <button type="submit" className="btn-primary py-1.5 px-3 text-sm">Search</button>
        </form>
        <select value={project} onChange={e => setProject(e.target.value)} className="input h-8 text-sm w-40">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} className="input h-8 text-sm w-44">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={() => { setSearch(''); setProject(''); setCategory(''); }} className="btn-ghost text-sm py-1.5">Clear</button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-primary-500" /></div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No files found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {['File', 'Project / Module', 'Version', 'Status', 'Owner', 'Jira', 'Size', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100 truncate">{f.name}</div>
                          <div className="text-xs text-gray-400 truncate">{f.original_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      <div className="font-medium text-gray-700 dark:text-gray-300">{f.project}</div>
                      <div>{f.module}</div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5 font-mono">v{f.version}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{f.owner_name}</td>
                    <td className="px-4 py-3">
                      {f.jira_ticket && <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{f.jira_ticket}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFile(f)} title="View" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Eye size={14} /></button>
                        <button onClick={() => window.open(`/api/files/${f.id}/download`, '_blank')} title="Download" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Download size={14} /></button>
                        {isLead && (
                          <>
                            <button onClick={() => { openFile(f).then(() => setShowApprove(true)); setSelected(f); }} title="Review" className="p-1.5 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 text-primary-500">
                              <GitBranch size={14} />
                            </button>
                            <button onClick={() => doArchive(f.id)} title="Archive" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Archive size={14} /></button>
                          </>
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

      {/* File Detail Modal */}
      {selected && !showApprove && !showVersions && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="File Details" size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FileIcon mimeType={selected.mime_type} name={selected.original_name} size={36} />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selected.name}</h3>
                <p className="text-sm text-gray-500">{selected.original_name} · {formatBytes(selected.size)}</p>
                <StatusBadge status={selected.status} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Project', selected.project], ['Module', selected.module], ['Category', selected.category],
                ['Version', `v${selected.version}`], ['Owner', selected.owner_name], ['Repository', selected.repository_name],
                ['Jira Ticket', selected.jira_ticket], ['Tags', selected.tags],
              ].map(([l, v]) => v ? (
                <div key={l}>
                  <span className="text-gray-500 dark:text-gray-400">{l}: </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{v}</span>
                </div>
              ) : null)}
            </div>
            {selected.description && <div className="text-sm text-gray-600 dark:text-gray-300 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">{selected.description}</div>}

            {/* Versions */}
            {selected.versions?.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">Version History</h4>
                <div className="space-y-2">
                  {selected.versions.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
                      <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded font-mono">v{v.version}</span>
                      <span className="text-gray-500">{v.change_log}</span>
                      <span className="ml-auto text-xs text-gray-400">{v.created_by_name} · {new Date(v.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => window.open(`/api/files/${selected.id}/download`, '_blank')} className="btn-secondary"><Download size={15} />Download</button>
              {isLead && selected.status !== 'published' && (
                <button onClick={() => setShowApprove(true)} className="btn-primary">Review / Approve</button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Modal */}
      <Modal open={showApprove} onClose={() => { setShowApprove(false); setSelected(null); }} title="Review File" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Update Status</label>
            <select value={approveStatus} onChange={e => setApproveStatus(e.target.value)} className="input">
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="draft">Return to Draft</option>
            </select>
          </div>
          <div>
            <label className="label">Comments</label>
            <textarea value={approveComment} onChange={e => setApproveComment(e.target.value)} className="input" rows={3} placeholder="Add review comments..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowApprove(false); setSelected(null); }} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} className="btn-primary">Update Status</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
