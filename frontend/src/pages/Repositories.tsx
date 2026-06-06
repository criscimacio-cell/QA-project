import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Plus,
  LayoutGrid, List, Upload, Search, RefreshCw, MoreVertical,
  Pencil, Trash2, FolderPlus, Database, ChevronsDownUp, ChevronsUpDown,
} from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/UI/Modal';

interface Repo {
  id: number; name: string; description: string;
  parent_id: number | null; type: string; file_count: number;
  children?: Repo[];
}
interface FileRecord {
  id: number; name: string; original_name: string; size: number;
  mime_type: string; status: string; project: string; category: string;
  owner_name: string; updated_at: string; jira_ticket: string; version: number;
}

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

function matchesSearch(node: Repo, q: string): boolean {
  if (!q) return true;
  if (node.name.toLowerCase().includes(q.toLowerCase())) return true;
  return node.children?.some(c => matchesSearch(c, q)) ?? false;
}

/* ── Tree Node ── */
function TreeNode({
  node, selected, onSelect, level = 0,
  forceOpen, isLead, isAdmin, onAddSub, onEdit, onDelete,
  treeSearch,
}: {
  node: Repo; selected: number | null; onSelect: (id: number) => void;
  level?: number; forceOpen?: boolean; isLead: boolean; isAdmin: boolean;
  onAddSub: (repo: Repo) => void; onEdit: (repo: Repo) => void;
  onDelete: (repo: Repo) => void; treeSearch: string;
}) {
  const [open, setOpen] = useState(level === 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasChildren = (node.children?.length || 0) > 0;
  const isSelected = selected === node.id;

  // force expand when searching
  const shouldOpen = forceOpen || (treeSearch ? matchesSearch(node, treeSearch) : open);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // filter hidden by search
  if (treeSearch && !matchesSearch(node, treeSearch)) return null;

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 py-1.5 pr-2 rounded-lg cursor-pointer text-sm transition-all select-none ${
          isSelected
            ? 'bg-[#08a49c]/10 text-[#08a49c] dark:bg-[#08a49c]/15'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => { onSelect(node.id); if (hasChildren) setOpen(o => !o); }}
      >
        {/* expand chevron */}
        <span className="w-4 flex-shrink-0 flex items-center justify-center">
          {hasChildren
            ? (shouldOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />)
            : null}
        </span>

        {/* folder icon */}
        {shouldOpen && hasChildren
          ? <FolderOpen size={15} className="flex-shrink-0 text-amber-400" />
          : <Folder size={15} className={`flex-shrink-0 ${level === 0 ? 'text-[#08a49c]' : 'text-amber-400'}`} />
        }

        <span className="flex-1 truncate text-[13px] font-medium">{node.name}</span>

        {/* file count badge */}
        {node.file_count > 0 && (
          <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-1.5 py-0.5 flex-shrink-0">
            {node.file_count}
          </span>
        )}

        {/* context menu — only for admin/lead, shown on hover */}
        {isLead && (
          <div
            ref={menuRef}
            className="relative flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setMenuOpen(m => !m)}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <MoreVertical size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-5 z-50 w-44 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 text-xs animate-scale-in">
                <button onClick={() => { onAddSub(node); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                  <FolderPlus size={13} className="text-[#08a49c]" /> Add Sub-folder
                </button>
                <button onClick={() => { onEdit(node); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                  <Pencil size={13} className="text-blue-500" /> Rename
                </button>
                {isAdmin && (
                  <>
                    <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                    <button onClick={() => { onDelete(node); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                      <Trash2 size={13} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {shouldOpen && hasChildren && node.children?.map(child => (
        <TreeNode
          key={child.id} node={child} selected={selected} onSelect={onSelect}
          level={level + 1} forceOpen={forceOpen} isLead={isLead} isAdmin={isAdmin}
          onAddSub={onAddSub} onEdit={onEdit} onDelete={onDelete}
          treeSearch={treeSearch}
        />
      ))}
    </div>
  );
}

/* ── Main Page ── */
export default function Repositories() {
  const { isLead, isEngineer, isAdmin } = useAuth();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [tree, setTree] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [repoDetail, setRepoDetail] = useState<any>(null);
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [fileSearch, setFileSearch] = useState('');
  const [treeSearch, setTreeSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  // modals
  const [showUpload, setShowUpload] = useState(false);
  const [createModal, setCreateModal] = useState<{ open: boolean; parentId: number | null; parentName: string }>({ open: false, parentId: null, parentName: '' });
  const [editModal, setEditModal] = useState<{ open: boolean; repo: Repo | null }>({ open: false, repo: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; repo: Repo | null }>({ open: false, repo: null });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadRepos = async () => {
    const r = await api.get('/repositories');
    setRepos(r.data);
    setTree(buildTree(r.data));
  };

  const loadDetail = async (id: number) => {
    setLoading(true);
    const r = await api.get(`/repositories/${id}`);
    setRepoDetail(r.data);
    setLoading(false);
  };

  useEffect(() => { loadRepos(); }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected]);

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
    !fileSearch || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  /* ── CRUD handlers ── */
  const openCreate = (parentId: number | null, parentName = '') => {
    setFormData({ name: '', description: '' });
    setCreateModal({ open: true, parentId, parentName });
  };

  const doCreate = async () => {
    if (!formData.name.trim()) return;
    setSaving(true);
    await api.post('/repositories', {
      name: formData.name.trim(),
      description: formData.description,
      parent_id: createModal.parentId,
      type: createModal.parentId ? 'folder' : 'repository',
    });
    setSaving(false);
    setCreateModal({ open: false, parentId: null, parentName: '' });
    await loadRepos();
    if (selected) loadDetail(selected);
  };

  const doEdit = async () => {
    if (!editModal.repo || !formData.name.trim()) return;
    setSaving(true);
    await api.put(`/repositories/${editModal.repo.id}`, { name: formData.name.trim(), description: formData.description });
    setSaving(false);
    setEditModal({ open: false, repo: null });
    await loadRepos();
    if (selected) loadDetail(selected);
  };

  const doDelete = async () => {
    if (!deleteModal.repo) return;
    setSaving(true);
    await api.delete(`/repositories/${deleteModal.repo.id}`);
    setSaving(false);
    setDeleteModal({ open: false, repo: null });
    if (selected === deleteModal.repo.id) setSelected(null);
    await loadRepos();
  };

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-4rem)]">

      {/* ══ Left Tree Panel ══ */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">

        {/* Tree header */}
        <div className="px-3 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Repositories</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAllOpen(o => !o)}
                title={allOpen ? 'Collapse all' : 'Expand all'}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {allOpen ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
              </button>
              {isLead && (
                <button
                  onClick={() => openCreate(null)}
                  title="New root repository"
                  className="p-1 rounded hover:bg-[#08a49c]/10 text-[#08a49c] transition-colors"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tree search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={treeSearch}
              onChange={e => setTreeSearch(e.target.value)}
              placeholder="Find repository…"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-[#08a49c] transition-colors"
            />
          </div>
        </div>

        {/* Tree body */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
              <Database size={28} className="opacity-30" />
              <p className="text-xs text-center">No repositories yet</p>
              {isLead && (
                <button onClick={() => openCreate(null)} className="text-xs text-[#08a49c] hover:underline font-medium">
                  + Create one
                </button>
              )}
            </div>
          ) : tree.map(node => (
            <TreeNode
              key={node.id} node={node} selected={selected} onSelect={setSelected}
              level={0} forceOpen={allOpen || !!treeSearch} isLead={isLead} isAdmin={isAdmin}
              onAddSub={repo => openCreate(repo.id, repo.name)}
              onEdit={repo => { setFormData({ name: repo.name, description: repo.description }); setEditModal({ open: true, repo }); }}
              onDelete={repo => setDeleteModal({ open: true, repo })}
              treeSearch={treeSearch}
            />
          ))}
        </div>

        {/* Add repo shortcut at bottom */}
        {isLead && (
          <div className="flex-shrink-0 p-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => openCreate(null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#08a49c] border border-dashed border-[#08a49c]/40 hover:border-[#08a49c] hover:bg-[#08a49c]/5 transition-all"
            >
              <Plus size={13} /> New Repository
            </button>
          </div>
        )}
      </div>

      {/* ══ Right Content Panel ══ */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">

        {/* Toolbar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-2.5 flex items-center gap-3 flex-wrap flex-shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
            {breadcrumb.length === 0 ? (
              <span className="text-slate-400 text-xs">Select a folder from the left panel</span>
            ) : breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1 text-xs">
                {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
                <span className={i === breadcrumb.length - 1
                  ? 'font-semibold text-slate-900 dark:text-slate-100'
                  : 'text-slate-400 hover:text-[#08a49c] cursor-pointer transition-colors'}>
                  {b}
                </span>
              </span>
            ))}
          </div>

          {/* File search */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={fileSearch} onChange={e => setFileSearch(e.target.value)}
              placeholder="Filter files…"
              className="input pl-8 h-8 text-xs w-44"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} className={`p-1.5 transition-colors ${view === 'list' ? 'bg-[#08a49c] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600'}`}><List size={14} /></button>
            <button onClick={() => setView('grid')} className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-[#08a49c] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={14} /></button>
          </div>

          {selected && isLead && (
            <button onClick={() => openCreate(selected, selectedRepo?.name)} className="btn-secondary text-xs py-1.5 px-3">
              <FolderPlus size={13} /> Sub-folder
            </button>
          )}
          {selected && isEngineer && (
            <button onClick={() => setShowUpload(true)} className="btn-primary text-xs py-1.5 px-3">
              <Upload size={13} /> Upload
            </button>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Database size={36} className="opacity-30" />
              </div>
              <p className="text-sm font-medium">Select a repository</p>
              <p className="text-xs text-slate-400">Choose a folder from the left panel to view its contents</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={18} className="animate-spin text-[#08a49c]" />
            </div>
          ) : (
            <>
              {/* Repo info header */}
              {selectedRepo && (
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FolderOpen size={18} className="text-amber-400" />
                      {selectedRepo.name}
                    </h2>
                    {selectedRepo.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-6">{selectedRepo.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1 ml-6">{filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}</p>
                  </div>
                  {isLead && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setFormData({ name: selectedRepo.name, description: selectedRepo.description }); setEditModal({ open: true, repo: selectedRepo as Repo }); }}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        <Pencil size={12} /> Rename
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-folders grid */}
              {repoDetail?.children?.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Folders</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {repoDetail.children.map((c: any) => (
                      <div
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                        className="card p-3 cursor-pointer hover:border-[#08a49c]/40 hover:shadow-md transition-all group"
                      >
                        <Folder size={26} className="text-amber-400 mb-2 group-hover:text-amber-500 transition-colors" />
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{c.file_count || 0} files</div>
                      </div>
                    ))}
                    {isLead && (
                      <button
                        onClick={() => openCreate(selected, selectedRepo?.name)}
                        className="card p-3 flex flex-col items-center justify-center gap-1.5 border-dashed cursor-pointer hover:border-[#08a49c]/50 hover:bg-[#08a49c]/5 transition-all text-slate-400 hover:text-[#08a49c]"
                      >
                        <Plus size={20} />
                        <span className="text-[10px] font-medium">New folder</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Files */}
              {filteredFiles.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <FolderOpen size={36} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm">{fileSearch ? 'No files match your search' : 'No files in this folder'}</p>
                  {isEngineer && !fileSearch && (
                    <button onClick={() => setShowUpload(true)} className="btn-primary mt-4 mx-auto text-sm">
                      <Upload size={14} /> Upload Files
                    </button>
                  )}
                </div>
              ) : view === 'list' ? (
                <div className="card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        {['Name', 'Category', 'Version', 'Status', 'Owner', 'Jira', 'Size', 'Updated'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredFiles.map((f: FileRecord) => (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2 max-w-[200px]">
                              <FileIcon mimeType={f.mime_type} name={f.original_name} size={16} />
                              <span className="font-medium text-slate-900 dark:text-slate-100 truncate text-xs">{f.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{f.category}</td>
                          <td className="px-4 py-2.5"><span className="text-[10px] bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 font-mono">v{f.version}</span></td>
                          <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{f.owner_name}</td>
                          <td className="px-4 py-2.5">
                            {f.jira_ticket && <span className="text-[10px] text-blue-600 font-mono bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{f.jira_ticket}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-[10px] text-slate-400">{formatBytes(f.size)}</td>
                          <td className="px-4 py-2.5 text-[10px] text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {filteredFiles.map((f: FileRecord) => (
                    <div key={f.id} className="card p-3 hover:shadow-md transition-all cursor-pointer group">
                      <FileIcon mimeType={f.mime_type} name={f.original_name} size={24} />
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate mt-2">{f.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{formatBytes(f.size)}</div>
                      <div className="mt-1.5"><StatusBadge status={f.status} /></div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ Create Repository / Folder Modal ══ */}
      <Modal open={createModal.open} onClose={() => setCreateModal(m => ({ ...m, open: false }))}
        title={createModal.parentId ? `New Sub-folder in "${createModal.parentName}"` : 'New Repository'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">{createModal.parentId ? 'Folder' : 'Repository'} Name *</label>
            <input
              autoFocus
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              className="input"
              placeholder={createModal.parentId ? 'e.g. Test Cases' : 'e.g. PhilHealth QA'}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              className="input" rows={2}
              placeholder="Optional description…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreateModal(m => ({ ...m, open: false }))} className="btn-secondary">Cancel</button>
            <button onClick={doCreate} disabled={!formData.name.trim() || saving} className="btn-primary">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {createModal.parentId ? 'Create Folder' : 'Create Repository'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Edit / Rename Modal ══ */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, repo: null })} title="Rename" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              autoFocus
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && doEdit()}
              className="input"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} className="input" rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditModal({ open: false, repo: null })} className="btn-secondary">Cancel</button>
            <button onClick={doEdit} disabled={!formData.name.trim() || saving} className="btn-primary">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Pencil size={14} />}
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Delete Confirm Modal ══ */}
      <Modal open={deleteModal.open} onClose={() => setDeleteModal({ open: false, repo: null })} title="Delete Repository" size="sm">
        <div className="space-y-4">
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">
              Are you sure you want to delete <strong>"{deleteModal.repo?.name}"</strong>?
              This will also delete all sub-folders. Files inside will be unlinked but not permanently deleted.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteModal({ open: false, repo: null })} className="btn-secondary">Cancel</button>
            <button
              onClick={doDelete}
              disabled={saving}
              className="btn-danger"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Upload Modal ══ */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        repositoryId={selected}
        repos={repos}
        onSuccess={() => { if (selected) loadDetail(selected); }}
      />
    </div>
  );
}

/* ── Upload Modal ── */
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
      setFile(null);
      setForm({ name: '', project: '', module: '', category: '', jira_ticket: '', tags: '', description: '', version: '1' });
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Upload File" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-[#08a49c]/50 transition-colors"
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileIcon name={file.name} size={28} />
              <div className="text-left">
                <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">{file.name}</div>
                <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button type="button" onClick={() => setFile(null)} className="ml-2 text-xs text-red-500 hover:text-red-700">Remove</button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <Upload size={28} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-500 mb-1">Drop a file here or <span className="text-[#08a49c] font-medium">browse</span></p>
              <p className="text-xs text-slate-400">Excel, PDF, Word, ZIP, JSON, XML, CSV, Images</p>
              <input type="file" className="hidden" onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setFile(f); if (!form.name) setForm(p => ({ ...p, name: f.name.replace(/\.[^/.]+$/, '') })); }
              }} />
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Display Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="File display name" required /></div>
          <div>
            <label className="label">Repository *</label>
            <select value={selectedRepo} onChange={e => setSelectedRepo(e.target.value)} className="input" required>
              <option value="">Select repository…</option>
              {repos.filter((r: any) => r.parent_id !== null).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="label">Project</label><input value={form.project} onChange={e => setForm(p => ({ ...p, project: e.target.value }))} className="input" placeholder="e.g. PhilHealth" /></div>
          <div><label className="label">Module</label><input value={form.module} onChange={e => setForm(p => ({ ...p, module: e.target.value }))} className="input" placeholder="e.g. CF4" /></div>
          <div>
            <label className="label">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
              <option value="">Select category…</option>
              {['Test Cases', 'RCA', 'Evidence', 'Test Plan', 'Test Data', 'Bug Report', 'Template', 'Test Scripts', 'Performance'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Jira Ticket</label><input value={form.jira_ticket} onChange={e => setForm(p => ({ ...p, jira_ticket: e.target.value }))} className="input" placeholder="e.g. QA-123" /></div>
          <div><label className="label">Version</label><input type="number" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} className="input" min="1" /></div>
          <div><label className="label">Tags</label><input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="input" placeholder="comma, separated, tags" /></div>
        </div>
        <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input" rows={2} placeholder="Brief description…" /></div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={!file || loading} className="btn-primary">
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            Upload File
          </button>
        </div>
      </form>
    </Modal>
  );
}
