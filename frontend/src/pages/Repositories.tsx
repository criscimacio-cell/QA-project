import { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Plus,
  LayoutGrid, List, Upload, Search, RefreshCw, MoreVertical,
  Pencil, Trash2, FolderPlus, Database, ChevronsDownUp, ChevronsUpDown, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
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
            ? 'bg-[#F59E0B]/10 text-[#F59E0B] dark:bg-[#F59E0B]/15'
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
          : <Folder size={15} className={`flex-shrink-0 ${level === 0 ? 'text-[#F59E0B]' : 'text-amber-400'}`} />
        }

        <span className="flex-1 truncate text-[13px] font-medium">{node.name}</span>

        {/* file count badge */}
        {node.file_count > 0 && (
          <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full px-1.5 py-0.5 flex-shrink-0">
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
              aria-label="Repository options"
              aria-expanded={menuOpen}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <MoreVertical size={13} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-5 z-50 w-44 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 text-xs animate-scale-in">
                <button onClick={() => { onAddSub(node); setMenuOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                  <FolderPlus size={13} className="text-[#F59E0B]" /> Add Sub-folder
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
  const [repoErrors, setRepoErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const loadRepos = async () => {
    try {
      const r = await api.get('/repositories');
      setRepos(r.data);
      setTree(buildTree(r.data));
    } catch {
      toast.error('Failed to load repositories');
    }
  };

  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const r = await api.get(`/repositories/${id}`);
      setRepoDetail(r.data);
    } catch {
      toast.error('Failed to load repository contents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRepos(); }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected]);

  const selectedRepo = repos.find(r => r.id === selected);
  const breadcrumb: { id: number; name: string }[] = [];
  if (selected) {
    let cur = repos.find(r => r.id === selected);
    while (cur) {
      breadcrumb.unshift({ id: cur.id, name: cur.name });
      cur = cur.parent_id ? repos.find(r => r.id === cur!.parent_id) : undefined;
    }
  }

  const filteredFiles = (repoDetail?.files || []).filter((f: FileRecord) =>
    !fileSearch || f.name.toLowerCase().includes(fileSearch.toLowerCase())
  );

  /* ── CRUD handlers ── */
  const openCreate = (parentId: number | null, parentName = '') => {
    setFormData({ name: '', description: '' });
    setRepoErrors({});
    setCreateModal({ open: true, parentId, parentName });
  };

  const doCreate = async () => {
    const nameTrimmed = formData.name.trim();
    if (!nameTrimmed) { setRepoErrors({ name: 'Repository name is required' }); return; }
    if (nameTrimmed.length < 2) { setRepoErrors({ name: 'Name must be at least 2 characters' }); return; }
    if (nameTrimmed.length > 100) { setRepoErrors({ name: 'Name must be 100 characters or fewer' }); return; }
    setSaving(true);
    try {
      await api.post('/repositories', {
        name: formData.name.trim(),
        description: formData.description,
        parent_id: createModal.parentId,
        type: createModal.parentId ? 'folder' : 'repository',
      });
      toast.success(createModal.parentId ? 'Folder created' : 'Repository created');
      setCreateModal({ open: false, parentId: null, parentName: '' });
      await loadRepos();
      if (selected) loadDetail(selected);
    } catch {
      toast.error('Failed to create. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doEdit = async () => {
    if (!editModal.repo) return;
    const nameTrimmed = formData.name.trim();
    if (!nameTrimmed) { setRepoErrors({ name: 'Repository name is required' }); return; }
    if (nameTrimmed.length < 2) { setRepoErrors({ name: 'Name must be at least 2 characters' }); return; }
    if (nameTrimmed.length > 100) { setRepoErrors({ name: 'Name must be 100 characters or fewer' }); return; }
    setSaving(true);
    try {
      await api.put(`/repositories/${editModal.repo.id}`, { name: formData.name.trim(), description: formData.description });
      toast.success('Renamed successfully');
      setEditModal({ open: false, repo: null });
      await loadRepos();
      if (selected) loadDetail(selected);
    } catch {
      toast.error('Failed to rename. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteModal.repo) return;
    setSaving(true);
    const deletedId = deleteModal.repo.id;
    const parentId = deleteModal.repo.parent_id;
    try {
      await api.delete(`/repositories/${deletedId}`);
      toast.success('Repository deleted');
      setDeleteModal({ open: false, repo: null });
      if (selected === deletedId) setSelected(null);
      await loadRepos();
      // Reload detail for current selection if it's still valid
      if (selected && selected !== deletedId) loadDetail(selected);
      else if (parentId && parentId !== deletedId) loadDetail(parentId);
    } catch {
      toast.error('Failed to delete. Please try again.');
    } finally {
      setSaving(false);
    }
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
                  className="p-1 rounded hover:bg-[#F59E0B]/10 text-[#F59E0B] transition-colors"
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
              aria-label="Search repositories"
              className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400 outline-none focus:border-[#F59E0B] transition-colors"
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
                <button onClick={() => openCreate(null)} className="text-xs text-[#F59E0B] hover:underline font-medium">
                  + Create one
                </button>
              )}
            </div>
          ) : tree.map(node => (
            <TreeNode
              key={node.id} node={node} selected={selected} onSelect={setSelected}
              level={0} forceOpen={allOpen || !!treeSearch} isLead={isLead} isAdmin={isAdmin}
              onAddSub={repo => openCreate(repo.id, repo.name)}
              onEdit={repo => { setFormData({ name: repo.name, description: repo.description }); setRepoErrors({}); setEditModal({ open: true, repo }); }}
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
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#F59E0B] border border-dashed border-[#F59E0B]/40 hover:border-[#F59E0B] hover:bg-[#F59E0B]/5 transition-all"
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
              <span key={b.id} className="flex items-center gap-1 text-xs">
                {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
                <span
                  className={i === breadcrumb.length - 1
                    ? 'font-semibold text-slate-900 dark:text-slate-100'
                    : 'text-slate-400 hover:text-[#F59E0B] cursor-pointer transition-colors'}
                  onClick={i < breadcrumb.length - 1 ? () => setSelected(b.id) : undefined}
                >
                  {b.name}
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
              aria-label="Filter files"
              className="input pl-8 h-8 text-xs w-44"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <button onClick={() => setView('list')} aria-label="List view" aria-pressed={view === 'list'} className={`p-1.5 transition-colors ${view === 'list' ? 'bg-[#F59E0B] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600'}`}><List size={14} /></button>
            <button onClick={() => setView('grid')} aria-label="Grid view" aria-pressed={view === 'grid'} className={`p-1.5 transition-colors ${view === 'grid' ? 'bg-[#F59E0B] text-white' : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={14} /></button>
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
              {isLead && tree.length === 0 && (
                <button onClick={() => openCreate(null)} className="btn-primary text-xs mt-2">
                  <Plus size={13} /> Create First Repository
                </button>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw size={18} className="animate-spin text-[#F59E0B]" />
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
                        onClick={() => { setFormData({ name: selectedRepo.name, description: selectedRepo.description }); setRepoErrors({}); setEditModal({ open: true, repo: selectedRepo as Repo }); }}
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
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Folders</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {repoDetail.children.map((c: any) => (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(c.id)}
                        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelected(c.id)}
                        className="card p-3 cursor-pointer hover:border-[#F59E0B]/40 hover:shadow-md transition-all group"
                      >
                        <Folder size={26} className="text-amber-400 mb-2 group-hover:text-amber-500 transition-colors" />
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.file_count || 0} files</div>
                      </div>
                    ))}
                    {isLead && (
                      <button
                        onClick={() => openCreate(selected, selectedRepo?.name)}
                        className="card p-3 flex flex-col items-center justify-center gap-1.5 border-dashed cursor-pointer hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/5 transition-all text-slate-400 hover:text-[#F59E0B]"
                      >
                        <Plus size={20} />
                        <span className="text-xs font-medium">New folder</span>
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
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
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
                          <td className="px-4 py-2.5"><span className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 font-mono">v{f.version}</span></td>
                          <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{f.owner_name}</td>
                          <td className="px-4 py-2.5">
                            {f.jira_ticket && <span className="text-xs text-blue-600 font-mono bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{f.jira_ticket}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">{formatBytes(f.size)}</td>
                          <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {filteredFiles.map((f: FileRecord) => (
                    <div key={f.id} title={f.name} aria-label={f.name} role="article" className="card p-3 hover:shadow-md transition-all cursor-pointer group">
                      <FileIcon mimeType={f.mime_type} name={f.original_name} size={24} />
                      <div className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate mt-2">{f.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatBytes(f.size)}</div>
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
            <label className="label">{createModal.parentId ? 'Folder' : 'Repository'} Name<span className="text-red-500 ml-0.5">*</span></label>
            <input
              autoFocus
              value={formData.name}
              onChange={e => { setFormData(f => ({ ...f, name: e.target.value })); if (repoErrors.name) setRepoErrors(p => ({ ...p, name: '' })); }}
              onKeyDown={e => e.key === 'Enter' && doCreate()}
              className={`input ${repoErrors.name ? 'border-red-400 focus:ring-red-300' : ''}`}
              placeholder={createModal.parentId ? 'e.g. Test Cases' : 'e.g. PhilHealth QA'}
            />
            {repoErrors.name && <p className="text-xs text-red-500 mt-1">{repoErrors.name}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value.slice(0, 500) }))}
              maxLength={500}
              className="input" rows={2}
              placeholder="Optional description…"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{formData.description.length}/500</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setCreateModal(m => ({ ...m, open: false }))} className="btn-secondary">Cancel</button>
            <button onClick={doCreate} disabled={!formData.name.trim() || saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {createModal.parentId ? 'Create Folder' : 'Create Repository'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Edit / Rename Modal ══ */}
      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, repo: null })} title="Rename" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name<span className="text-red-500 ml-0.5">*</span></label>
            <input
              autoFocus
              value={formData.name}
              onChange={e => { setFormData(f => ({ ...f, name: e.target.value })); if (repoErrors.name) setRepoErrors(p => ({ ...p, name: '' })); }}
              onKeyDown={e => e.key === 'Enter' && doEdit()}
              className={`input ${repoErrors.name ? 'border-red-400 focus:ring-red-300' : ''}`}
            />
            {repoErrors.name && <p className="text-xs text-red-500 mt-1">{repoErrors.name}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value.slice(0, 500) }))} maxLength={500} className="input" rows={2} />
            <p className="text-xs text-slate-400 mt-1 text-right">{formData.description.length}/500</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditModal({ open: false, repo: null })} className="btn-secondary">Cancel</button>
            <button onClick={doEdit} disabled={!formData.name.trim() || saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
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
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
  const [mode, setMode] = useState<'file' | 'folder'>('file');
  const [form, setForm] = useState({ name: '', project: '', module: '', category: '', jira_ticket: '', tags: '', description: '', version: '1' });
  const [file, setFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(repositoryId?.toString() || '');
  const [categories, setCategories] = useState<string[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => { setSelectedRepo(repositoryId?.toString() || ''); }, [repositoryId]);
  useEffect(() => { setFile(null); setFolderFiles([]); setUploadErrors({}); setProgress(''); }, [mode]);

  useEffect(() => {
    api.get('/categories', { params: { type: 'file' } })
      .then(r => setCategories(r.data.map((c: any) => c.name)))
      .catch(() => {});
  }, []);

  const reset = () => {
    setFile(null); setFolderFiles([]); setUploadErrors({}); setProgress('');
    setForm({ name: '', project: '', module: '', category: '', jira_ticket: '', tags: '', description: '', version: '1' });
    setMode('file');
    setSelectedRepo(repositoryId?.toString() || '');
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (mode === 'file' && !form.name.trim()) errs.name = 'Display name is required';
    if (mode === 'file' && form.name.trim().length > 200) errs.name = 'Display name must be 200 characters or fewer';
    if (!selectedRepo) errs.repository_id = 'Please select a repository';
    if (mode === 'file' && !file) errs.file = 'Please choose a file to upload';
    else if (mode === 'file' && file && file.size > 50 * 1024 * 1024) errs.file = 'File exceeds the 50 MB limit';
    if (mode === 'folder' && !folderFiles.length) errs.file = 'Please select a folder';
    else if (mode === 'folder' && folderFiles.some(f => f.size > 50 * 1024 * 1024)) errs.file = 'One or more files exceed the 50 MB limit';
    if (form.jira_ticket.trim() && !/^[A-Z]+-\d+$/.test(form.jira_ticket.trim())) errs.jira_ticket = 'Format: PROJECT-123';
    if (form.tags.trim() && /[^a-zA-Z0-9,\- ]/.test(form.tags)) errs.tags = 'Tags may only contain letters, numbers, commas, hyphens, and spaces';
    if (mode === 'file') {
      const vNum = parseInt(form.version, 10);
      if (!form.version || isNaN(vNum) || vNum < 1 || String(vNum) !== form.version.trim()) errs.version = 'Version must be a positive integer (e.g. 1)';
    }
    if (form.project.trim().length > 100) errs.project = 'Project must be 100 characters or fewer';
    if (form.module.trim().length > 100) errs.module = 'Module must be 100 characters or fewer';
    setUploadErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'file') {
        const fd = new FormData();
        fd.append('file', file as File);
        Object.entries(form).forEach(([k, v]) => fd.append(k, v));
        fd.append('repository_id', selectedRepo);
        await api.post('/files/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        // Folder mode — bulk upload all files
        setProgress(`Uploading ${folderFiles.length} file(s)…`);
        const fd = new FormData();
        folderFiles.forEach(f => fd.append('files', f));
        fd.append('repository_id', selectedRepo);
        if (form.project) fd.append('project', form.project);
        if (form.module) fd.append('module', form.module);
        if (form.category) fd.append('category', form.category);
        await api.post('/files/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setProgress(`✓ ${folderFiles.length} files uploaded`);
        await new Promise(r => setTimeout(r, 800));
      }
      // Only create category after successful upload
      const catName = form.category.trim();
      if (catName && catName.length <= 100 && !categories.includes(catName)) {
        await api.post('/categories', { name: catName, type: 'file' }).catch(() => {});
        setCategories(prev => [...prev, catName]);
      }
      toast.success(mode === 'folder' ? `${folderFiles.length} files uploaded successfully` : 'File uploaded successfully');
      onClose(); onSuccess(); reset();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Upload failed';
      setProgress(msg);
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={() => { if (!loading) { onClose(); reset(); } }} title="Upload to Repository" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {(['file', 'folder'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${mode === m ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}>
              {m === 'file' ? '📄 Single File' : '📁 Folder'}
            </button>
          ))}
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${dragOver ? 'border-[#F59E0B] bg-[#F59E0B]/5' : uploadErrors.file ? 'border-red-400' : 'border-slate-200 dark:border-slate-700 hover:border-[#F59E0B]/50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false);
            if (mode === 'file') {
              const f = e.dataTransfer.files?.[0];
              if (f) { setFile(f); setUploadErrors(p => ({ ...p, file: '' })); if (!form.name) setForm(p => ({ ...p, name: f.name.replace(/\.[^/.]+$/, '') })); }
            } else {
              const dropped = Array.from(e.dataTransfer.files);
              if (dropped.length) { setFolderFiles(dropped); setUploadErrors(p => ({ ...p, file: '' })); }
            }
          }}
        >
          {mode === 'file' ? (
            file ? (
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
                <p className="text-sm text-slate-500 mb-1">Drop a file here or <span className="text-[#F59E0B] font-medium">browse</span></p>
                <p className="text-xs text-slate-400">Any file type · Max 50 MB</p>
                <input type="file" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setUploadErrors(p => ({ ...p, file: '' })); if (!form.name) setForm(p => ({ ...p, name: f.name.replace(/\.[^/.]+$/, '') })); }
                }} />
              </label>
            )
          ) : (
            folderFiles.length > 0 ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">📁 {folderFiles.length} files selected</p>
                <div className="max-h-28 overflow-y-auto text-xs text-slate-400 text-left space-y-0.5 mt-2">
                  {folderFiles.slice(0, 20).map((f, i) => <div key={i} className="truncate">{f.webkitRelativePath || f.name}</div>)}
                  {folderFiles.length > 20 && <div className="text-slate-400">…and {folderFiles.length - 20} more</div>}
                </div>
                <button type="button" onClick={() => setFolderFiles([])} className="mt-2 text-xs text-red-500 hover:text-red-700">Clear</button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload size={28} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500 mb-1">Click to select a folder</p>
                <p className="text-xs text-slate-400">All files inside will be uploaded · Max 50 MB each</p>
                <input type="file" className="hidden" {...{ webkitdirectory: 'true' } as any} multiple onChange={e => {
                  const files = Array.from(e.target.files || []);
                  if (files.length) { setFolderFiles(files); setUploadErrors(p => ({ ...p, file: '' })); }
                }} />
              </label>
            )
          )}
        </div>
        {uploadErrors.file && <p className="text-xs text-red-500 -mt-2">{uploadErrors.file}</p>}

        <div className="grid grid-cols-2 gap-3">
          {mode === 'file' && (
            <div>
              <label className="label">Display Name<span className="text-red-500 ml-0.5">*</span></label>
              <input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (uploadErrors.name) setUploadErrors(p => ({ ...p, name: '' })); }} className={`input ${uploadErrors.name ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="File display name" />
              {uploadErrors.name && <p className="text-xs text-red-500 mt-1">{uploadErrors.name}</p>}
            </div>
          )}
          <div>
            <label className="label">Repository<span className="text-red-500 ml-0.5">*</span></label>
            <select value={selectedRepo} onChange={e => { setSelectedRepo(e.target.value); if (uploadErrors.repository_id) setUploadErrors(p => ({ ...p, repository_id: '' })); }} className={`input ${uploadErrors.repository_id ? 'border-red-400 focus:ring-red-300' : ''}`}>
              <option value="">Select repository…</option>
              {repos.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {uploadErrors.repository_id && <p className="text-xs text-red-500 mt-1">{uploadErrors.repository_id}</p>}
          </div>
          <div>
            <label className="label">Project</label>
            <input value={form.project} onChange={e => { setForm(p => ({ ...p, project: e.target.value })); if (uploadErrors.project) setUploadErrors(p => ({ ...p, project: '' })); }} className={`input ${uploadErrors.project ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="e.g. PhilHealth" />
            {uploadErrors.project && <p className="text-xs text-red-500 mt-1">{uploadErrors.project}</p>}
          </div>
          <div>
            <label className="label">Module</label>
            <input value={form.module} onChange={e => { setForm(p => ({ ...p, module: e.target.value })); if (uploadErrors.module) setUploadErrors(p => ({ ...p, module: '' })); }} className={`input ${uploadErrors.module ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="e.g. CF4" />
            {uploadErrors.module && <p className="text-xs text-red-500 mt-1">{uploadErrors.module}</p>}
          </div>
          <div>
            <label className="label">Category</label>
            <input list="upload-category-options" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input" placeholder="Select or type a category…" />
            <datalist id="upload-category-options">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div>
            <label className="label">Jira Ticket</label>
            <input value={form.jira_ticket} onChange={e => { setForm(p => ({ ...p, jira_ticket: e.target.value })); if (uploadErrors.jira_ticket) setUploadErrors(p => ({ ...p, jira_ticket: '' })); }} className={`input ${uploadErrors.jira_ticket ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="e.g. QA-123" />
            {uploadErrors.jira_ticket && <p className="text-xs text-red-500 mt-1">{uploadErrors.jira_ticket}</p>}
          </div>
          {mode === 'file' && (
            <div>
              <label className="label">Version</label>
              <input type="number" value={form.version} onChange={e => { setForm(p => ({ ...p, version: e.target.value })); if (uploadErrors.version) setUploadErrors(p => ({ ...p, version: '' })); }} className={`input ${uploadErrors.version ? 'border-red-400 focus:ring-red-300' : ''}`} min="1" />
              {uploadErrors.version && <p className="text-xs text-red-500 mt-1">{uploadErrors.version}</p>}
            </div>
          )}
          <div>
            <label className="label">Tags</label>
            <input value={form.tags} onChange={e => { setForm(p => ({ ...p, tags: e.target.value })); if (uploadErrors.tags) setUploadErrors(p => ({ ...p, tags: '' })); }} className={`input ${uploadErrors.tags ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="comma, separated, tags" />
            {uploadErrors.tags && <p className="text-xs text-red-500 mt-1">{uploadErrors.tags}</p>}
          </div>
        </div>
        {mode === 'file' && <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input" rows={2} placeholder="Brief description…" /></div>}

        {progress && <p className={`text-sm text-center font-medium ${progress.startsWith('✓') ? 'text-emerald-500' : progress.includes('failed') ? 'text-red-500' : 'text-slate-500'}`}>{progress}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => { if (!loading) { onClose(); reset(); } }} disabled={loading} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={(mode === 'file' ? !file : !folderFiles.length) || loading} className="btn-primary">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {mode === 'folder' ? `Upload ${folderFiles.length || ''} Files` : 'Upload File'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
