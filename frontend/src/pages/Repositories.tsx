import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, LayoutGrid, List, Upload, Search, RefreshCw } from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';

interface Repo { id: number; name: string; description: string; parent_id: number | null; type: string; file_count: number; children?: Repo[]; }
interface FileRecord { id: number; name: string; original_name: string; size: number; mime_type: string; status: string; project: string; category: string; owner_name: string; updated_at: string; jira_ticket: string; version: number; }

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

function buildTree(repos: Repo[]): Repo[] {
  const map = new Map<number, Repo>();
  repos.forEach(r => map.set(r.id, { ...r, children: [] }));
  const roots: Repo[] = [];
  repos.forEach(r => {
    if (r.parent_id === null) roots.push(map.get(r.id)!);
    else map.get(r.parent_id)?.children?.push(map.get(r.id)!);
  });
  return roots;
}

function TreeNode({ node, selected, onSelect, level = 0 }: { node: Repo; selected: number | null; onSelect: (id: number) => void; level?: number }) {
  const [open, setOpen] = useState(level < 1);
  const hasChildren = (node.children?.length || 0) > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors group ${selected === node.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => { onSelect(node.id); if (hasChildren) setOpen(o => !o); }}
      >
        {hasChildren ? (
          open ? <ChevronDown size={14} className="flex-shrink-0" /> : <ChevronRight size={14} className="flex-shrink-0" />
        ) : <span className="w-3.5" />}
        {open && hasChildren ? <FolderOpen size={16} className="text-amber-500 flex-shrink-0" /> : <Folder size={16} className="text-amber-400 flex-shrink-0" />}
        <span className="truncate">{node.name}</span>
        {node.file_count > 0 && <span className="ml-auto text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-1.5 py-0.5">{node.file_count}</span>}
      </div>
      {open && hasChildren && node.children?.map(child => (
        <TreeNode key={child.id} node={child} selected={selected} onSelect={onSelect} level={level + 1} />
      ))}
    </div>
  );
}

export default function Repositories() {
  const { isEngineer } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [tree, setTree] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [repoDetail, setRepoDetail] = useState<any>(null);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newRepo, setNewRepo] = useState({ name: '', description: '' });

  useEffect(() => {
    api.get('/repositories').then(r => { setRepos(r.data); setTree(buildTree(r.data)); });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.get(`/repositories/${selected}`).then(r => setRepoDetail(r.data)).finally(() => setLoading(false));
  }, [selected]);

  const selectedRepo = repos.find(r => r.id === selected);
  const breadcrumb: string[] = [];
  if (selected) {
    let cur = repos.find(r => r.id === selected);
    while (cur) {
      breadcrumb.unshift(cur.name);
      cur = cur.parent_id ? repos.find(r => r.id === cur!.parent_id) : undefined;
    }
  }

  const filteredFiles = (repoDetail?.files || []).filter((f: FileRecord) =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  );

  const createFolder = async () => {
    if (!newRepo.name) return;
    await api.post('/repositories', { ...newRepo, parent_id: selected, type: 'folder' });
    setShowCreate(false); setNewRepo({ name: '', description: '' });
    const r = await api.get('/repositories');
    setRepos(r.data); setTree(buildTree(r.data));
    if (selected) { const d = await api.get(`/repositories/${selected}`); setRepoDetail(d.data); }
  };

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-4rem)]">
      {/* Tree Panel */}
      <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Repositories</h2>
        </div>
        <div className="p-2">
          {tree.map(node => (
            <TreeNode key={node.id} node={node} selected={selected} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {/* Content Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 flex-1">
            {breadcrumb.length === 0 ? (
              <span>Select a folder</span>
            ) : breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} />}
                <span className={i === breadcrumb.length - 1 ? 'text-gray-900 dark:text-gray-100 font-medium' : 'hover:text-primary-500 cursor-pointer'}>{b}</span>
              </span>
            ))}
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter files..." className="input pl-8 h-8 text-sm w-48" />
          </div>

          <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} className={`p-1.5 ${view === 'list' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><List size={15} /></button>
            <button onClick={() => setView('grid')} className={`p-1.5 ${view === 'grid' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500'}`}><LayoutGrid size={15} /></button>
          </div>

          {isEngineer && selected && (
            <>
              <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm py-1.5 px-3"><Plus size={15} />New Folder</button>
              <button onClick={() => setShowUpload(true)} className="btn-primary text-sm py-1.5 px-3"><Upload size={15} />Upload</button>
            </>
          )}
        </div>

        {/* Files */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Folder size={48} className="mb-3 opacity-30" />
              <p className="text-sm">Select a folder from the left panel</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={20} className="animate-spin text-primary-500" />
            </div>
          ) : (
            <>
              {selectedRepo && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedRepo.name}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{filteredFiles.length} files</p>
                </div>
              )}

              {/* Sub-folders */}
              {repoDetail?.children?.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folders</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
                    {repoDetail.children.map((c: any) => (
                      <div key={c.id} onClick={() => setSelected(c.id)} className="card p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all group">
                        <Folder size={32} className="text-amber-400 mb-2 group-hover:text-amber-500 transition-colors" />
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{c.file_count || 0} files</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredFiles.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{search ? 'No files match your search' : 'No files in this folder'}</p>
                  {isEngineer && !search && <button onClick={() => setShowUpload(true)} className="btn-primary mt-4 mx-auto">Upload Files</button>}
                </div>
              ) : view === 'list' ? (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        {['Name', 'Category', 'Version', 'Status', 'Owner', 'Jira', 'Updated'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {filteredFiles.map((f: FileRecord) => (
                        <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{f.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{f.category}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-gray-100 dark:bg-gray-800 rounded px-2 py-0.5">v{f.version}</span></td>
                          <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{f.owner_name}</td>
                          <td className="px-4 py-3">
                            {f.jira_ticket && <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{f.jira_ticket}</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{new Date(f.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredFiles.map((f: FileRecord) => (
                    <div key={f.id} className="card p-4 hover:shadow-md transition-all cursor-pointer group">
                      <div className="flex items-start gap-3 mb-3">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={28} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.name}</div>
                          <div className="text-xs text-gray-400">{formatBytes(f.size)}</div>
                        </div>
                      </div>
                      <StatusBadge status={f.status} />
                      <div className="text-xs text-gray-400 mt-2">{new Date(f.updated_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Folder Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Folder" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Folder Name</label>
            <input value={newRepo.name} onChange={e => setNewRepo(n => ({ ...n, name: e.target.value }))} className="input" placeholder="Enter folder name" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={newRepo.description} onChange={e => setNewRepo(n => ({ ...n, description: e.target.value }))} className="input" rows={3} placeholder="Optional description" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={createFolder} className="btn-primary">Create Folder</button>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} repositoryId={selected} repos={repos} onSuccess={() => { if (selected) api.get(`/repositories/${selected}`).then(r => setRepoDetail(r.data)); }} />
    </div>
  );
}

function UploadModal({ open, onClose, repositoryId, repos, onSuccess }: any) {
  const [form, setForm] = useState({ name: '', project: '', module: '', category: '', jira_ticket: '', tags: '', description: '', version: '1' });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(repositoryId?.toString() || '');

  useEffect(() => { setSelectedRepo(repositoryId?.toString() || ''); }, [repositoryId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append('repository_id', selectedRepo);
    try {
      await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onClose(); onSuccess();
      setFile(null); setForm({ name: '', project: '', module: '', category: '', jira_ticket: '', tags: '', description: '', version: '1' });
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload File" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileIcon name={file.name} size={32} />
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{file.name}</div>
                <div className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button type="button" onClick={() => setFile(null)} className="ml-2 text-red-500 hover:text-red-700 text-sm">Remove</button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <Upload size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 mb-1">Drop files here or <span className="text-primary-500 font-medium">browse</span></p>
              <p className="text-xs text-gray-400">Excel, PDF, Word, ZIP, JSON, XML, CSV, Images</p>
              <input type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.name) setForm(p => ({ ...p, name: f.name.replace(/\.[^/.]+$/, '') })); } }} />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Display Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="File display name" required /></div>
          <div>
            <label className="label">Repository *</label>
            <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} className="input" required>
              <option value="">Select repository...</option>
              {repos.filter((r: any) => r.parent_id !== null).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="label">Project</label><input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="input" placeholder="e.g. PhilHealth" /></div>
          <div><label className="label">Module</label><input value={form.module} onChange={e => setForm(p => ({ ...p, module: e.target.value }))} className="input" placeholder="e.g. CF4" /></div>
          <div><label className="label">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
              <option value="">Select category...</option>
              {['Test Cases', 'RCA', 'Evidence', 'Test Plan', 'Test Data', 'Bug Report', 'Template', 'Test Scripts', 'Performance'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Jira Ticket</label><input value={form.jira_ticket} onChange={e => setForm(p => ({ ...p, jira_ticket: e.target.value }))} className="input" placeholder="e.g. QA-123" /></div>
          <div><label className="label">Version</label><input type="number" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} className="input" min="1" /></div>
          <div><label className="label">Tags</label><input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="input" placeholder="comma, separated, tags" /></div>
        </div>
        <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input" rows={2} placeholder="Brief description..." /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!file || loading} className="btn-primary">
            {loading ? 'Uploading...' : 'Upload File'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
