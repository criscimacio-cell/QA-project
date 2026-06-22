import { useState, useEffect, useRef } from 'react';
import { Filter, Download, Archive, Eye, GitBranch, RefreshCw, Upload, X, RotateCcw, FileText, Image, Trash2, MessageSquare, CheckCircle, Clock, Files, Loader2, LayoutGrid, List, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import Pagination from '../components/UI/Pagination';
import StatusBadge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import ConfirmModal from '../components/UI/ConfirmModal';
import EmptyState from '../components/UI/EmptyState';
import { useAuth } from '../context/AuthContext';

async function downloadFile(fileId: number, filename: string, versionPath?: string) {
  try {
    const url = versionPath || `/api/files/${fileId}/download`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) { toast.error('Download failed — file not found on disk.'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  } catch { toast.error('Download failed'); }
}

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

const TABS = ['All Files', 'Pending Approval', 'Published'];
const TAB_STATUS: Record<string, string> = { 'Pending Approval': 'submitted', 'Published': 'published', 'Archived': 'archived' };

const APPROVAL_DOT: Record<string, string> = {
  approved: 'bg-emerald-500',
  published: 'bg-emerald-500',
  under_review: 'bg-amber-400',
  draft: 'bg-red-400',
  pending: 'bg-slate-400',
};

export default function FileManager() {
  const { user, isLead, isAdmin, isEngineer } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [fileOffset, setFileOffset] = useState(0);
  const FILE_LIMIT = 20;
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('All Files');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [approveStatus, setApproveStatus] = useState('approved');
  const [approveComment, setApproveComment] = useState('');
  const [approveError, setApproveError] = useState('');
  const [project, setProject] = useState('');
  const [category, setCategory] = useState('');

  // Bulk upload state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Detail modal tabs
  const [detailTab, setDetailTab] = useState<'details' | 'comments' | 'approvals'>('details');
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);

  const [viewMode, setViewMode] = useState<'table' | 'grouped'>('table');

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Confirm delete modal
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Confirm archive modal + success modal
  const [confirmArchive, setConfirmArchive] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState(false);

  useEffect(() => {
    if (!previewFile) { setPreviewBlobUrl(null); return; }
    setPreviewLoading(true);
    fetch(`/api/files/${previewFile.id}/preview`, { credentials: 'include' })
      .then(r => r.ok ? r.blob() : Promise.reject())
      .then(blob => setPreviewBlobUrl(URL.createObjectURL(blob)))
      .catch(() => setPreviewBlobUrl(null))
      .finally(() => setPreviewLoading(false));
    return () => { setPreviewBlobUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); };
  }, [previewFile?.id]);

  // Reset detail tab state when selected file changes
  useEffect(() => {
    setDetailTab('details');
    setComments([]);
    setApprovalHistory([]);
    setNewComment('');
    setCommentError('');
  }, [selected?.id]);

  const load = (overrides?: { search?: string; project?: string; category?: string }) => {
    setLoading(true);
    const params: any = {};
    if (TAB_STATUS[tab]) params.status = TAB_STATUS[tab];
    const effectiveSearch = overrides && 'search' in overrides ? overrides.search : search;
    const effectiveProject = overrides && 'project' in overrides ? overrides.project : project;
    const effectiveCategory = overrides && 'category' in overrides ? overrides.category : category;
    if (effectiveSearch) params.search = effectiveSearch;
    if (effectiveProject) params.project = effectiveProject;
    if (effectiveCategory) params.category = effectiveCategory;
    const off = overrides && 'offset' in overrides ? overrides.offset : fileOffset;
    params.limit = FILE_LIMIT;
    params.offset = off ?? 0;
    api.get('/files', { params }).then(r => {
      const data = r.data;
      if (Array.isArray(data)) { setFiles(data); setFileTotal(data.length); }
      else { setFiles(data.files ?? []); setFileTotal(data.total ?? 0); }
    }).catch(() => toast.error('Failed to load files')).finally(() => setLoading(false));
  };

  useEffect(() => { setFileOffset(0); load({ offset: 0 }); }, [tab, project, category]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const requiresComment = approveStatus === 'draft';

  const doApprove = async () => {
    if (!selected) return;
    if (requiresComment && approveComment.trim().length < 10) {
      setApproveError('Please provide a reason (min 10 characters)');
      return;
    }
    try {
      await api.post(`/files/${selected.id}/approve`, { status: approveStatus, comments: approveComment });
      toast.success('File status updated successfully');
      setShowApprove(false); setSelected(null); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); load();
    } catch (err: any) {
      setApproveError(err?.response?.data?.error || 'Failed to update status');
      toast.error('Failed to update file status');
    }
  };

  const doArchive = async () => {
    const id = confirmArchive.id;
    if (!id) return;
    setArchiveLoading(true);
    try {
      await api.post(`/files/${id}/archive`);
      setFiles(prev => prev.filter(f => f.id !== id));
      setConfirmArchive({ open: false, id: null, name: '' });
      setArchiveSuccess(true);
    } catch {
      toast.error('Failed to archive file');
    } finally {
      setArchiveLoading(false);
    }
  };

  const doRestore = async (id: number) => {
    try {
      await api.post(`/files/${id}/restore`);
      toast.success('File restored');
      load();
    } catch {
      toast.error('Failed to restore file');
    }
  };

  const [fileDetailLoading, setFileDetailLoading] = useState(false);

  const openFile = async (f: any) => {
    setFileDetailLoading(true);
    try {
      const r = await api.get(`/files/${f.id}`);
      setSelected(r.data);
    } catch {
      toast.error('Failed to load file details');
    } finally {
      setFileDetailLoading(false);
    }
  };

  const openPreview = (f: any) => {
    setPreviewFile(f);
    setShowPreview(true);
  };

  const isPreviewable = (f: any) =>
    f?.mime_type?.startsWith('image/') || f?.mime_type === 'application/pdf';

  // Bulk upload handlers
  const addBulkFiles = (incoming: File[]) => {
    setBulkFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}:${f.size}`));
      const deduped = incoming.filter(f => !existing.has(`${f.name}:${f.size}`));
      return [...prev, ...deduped];
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    addBulkFiles(dropped);
  };

  const removeFile = (i: number) => setBulkFiles(prev => prev.filter((_, idx) => idx !== i));

  const doBulkUpload = async () => {
    if (!bulkFiles.length) return;
    setBulkUploading(true);
    setBulkProgress(`Uploading ${bulkFiles.length} file(s)…`);
    try {
      const fd = new FormData();
      bulkFiles.forEach(f => fd.append('files', f));
      await api.post('/files/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBulkProgress('Upload complete!');
      toast.success('Files uploaded successfully');
      setTimeout(() => {
        setShowBulkUpload(false);
        setBulkFiles([]);
        setBulkProgress('');
        load();
      }, 1200);
    } catch (e: any) {
      setBulkProgress(e.response?.data?.error || 'Upload failed');
      toast.error('Upload failed. Please try again.');
    } finally {
      setBulkUploading(false);
    }
  };

  // Comments handlers
  const loadComments = async () => {
    if (!selected) return;
    setCommentLoading(true);
    try {
      const r = await api.get(`/files/${selected.id}/comments`);
      setComments(r.data);
    } finally {
      setCommentLoading(false);
    }
  };

  const postComment = async () => {
    if (!selected) return;
    if (!newComment.trim()) { setCommentError('Comment cannot be empty'); return; }
    if (newComment.trim().length > 500) { setCommentError('Comment must be 500 characters or fewer'); return; }
    setCommentError('');
    setCommentLoading(true);
    try {
      const r = await api.post(`/files/${selected.id}/comments`, { comment: newComment });
      setComments(prev => [...prev, r.data]);
      setNewComment('');
    } catch {
      setCommentError('Failed to post comment. Please try again.');
    } finally {
      setCommentLoading(false);
    }
  };

  const deleteComment = async (cid: number) => {
    if (!selected) return;
    try {
      await api.delete(`/files/${selected.id}/comments/${cid}`);
      setComments(prev => prev.filter(c => c.id !== cid));
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  // Approval history handler
  const loadApprovals = async () => {
    if (!selected) return;
    try {
      const r = await api.get(`/files/${selected.id}/approvals`);
      setApprovalHistory(r.data);
    } catch {
      toast.error('Failed to load approval history');
    }
  };

  const handleDetailTabChange = (t: 'details' | 'comments' | 'approvals') => {
    setDetailTab(t);
    if (t === 'comments') loadComments();
    if (t === 'approvals') loadApprovals();
  };

  // Bulk select handlers
  const allVisibleSelected = files.length > 0 && files.every(f => selectedIds.has(f.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => f.id)));
    }
  };
  const toggleOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const doBulkAction = async (action: 'archive' | 'delete' | 'submit') => {
    try {
      await api.post('/files/bulk-action', { ids: Array.from(selectedIds), action });
      toast.success(`${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''} updated`);
      setSelectedIds(new Set());
      load();
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const doBulkDownload = async () => {
    try {
      const res = await fetch('/api/files/bulk-download', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (!res.ok) { toast.error('Download failed'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `files-${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      toast.success('Download started');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete.id) return;
    setActionLoading(true);
    try {
      if (confirmDelete.id === -1) {
        // Bulk delete
        await api.post('/files/bulk-action', { ids: Array.from(selectedIds), action: 'delete' });
        toast.success(`${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''} deleted`);
        setSelectedIds(new Set());
      } else {
        await api.delete(`/files/${confirmDelete.id}`);
        toast.success('File deleted successfully');
      }
      setConfirmDelete({ open: false, id: null, name: '' });
      load();
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setActionLoading(false);
    }
  };

  // Export CSV
  const exportFiles = async () => {
    try {
      const res = await fetch('/api/files/export', { credentials: 'include' });
      if (!res.ok) { toast.error('Export failed'); return; }
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `files-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Export failed');
    }
  };

  const doCheckout = async (fileId: number) => {
    try {
      const r = await api.post(`/files/${fileId}/checkout`);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, checked_out_by: user?.id, checked_out_at: r.data.checkedOutAt, checked_out_by_name: user?.name } : f));
      toast.success('File checked out');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to check out file');
    }
  };

  const doCheckin = async (fileId: number) => {
    try {
      await api.post(`/files/${fileId}/checkin`);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, checked_out_by: null, checked_out_at: null, checked_out_by_name: null } : f));
      toast.success('File checked in');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to check in file');
    }
  };

  const projects = [...new Set(files.map(f => f.project).filter(Boolean))];
  const categories = [...new Set(files.map(f => f.category).filter(Boolean))];

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">File Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage all files and assets</p>
        </div>
        <div className="flex items-center gap-2">
          {isLead && (
            <button onClick={exportFiles} className="btn-secondary">
              <Download size={15} /> Export CSV
            </button>
          )}
          {isEngineer && (
            <button onClick={() => setShowBulkUpload(true)} className="btn-primary" onMouseDown={e => e.currentTarget.style.animation = 'springBounce 0.38s cubic-bezier(0.34,1.5,0.64,1) both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>
              <Upload size={15} /> Bulk Upload
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-slate-400" />
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, tags, Jira…" aria-label="Search files" className="input h-8 text-sm w-64" />
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
        <button onClick={() => { setSearch(''); setProject(''); setCategory(''); load({ search: '', project: '', category: '' }); }} className="btn-ghost text-sm py-1.5">Clear</button>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <List className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('grouped')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grouped' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <span className="text-sm font-semibold text-amber-500">{selectedIds.size} file{selectedIds.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2 ml-2">
            <button onClick={doBulkDownload} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"><Download size={13} /> Download as ZIP</button>
            {isEngineer && (
              <button onClick={async () => {
                try {
                  await api.post('/files/bulk-submit', { ids: Array.from(selectedIds) });
                  toast.success(`${selectedIds.size} file${selectedIds.size !== 1 ? 's' : ''} submitted for review`);
                  setSelectedIds(new Set());
                  load();
                } catch {
                  toast.error('Failed to submit files for review');
                }
              }} className="btn-secondary text-xs py-1.5 px-3">Submit for Review</button>
            )}
            {(isLead || isEngineer) && (
              <button onClick={() => doBulkAction('archive')} className="btn-secondary text-xs py-1.5 px-3">Archive Selected</button>
            )}
            {isAdmin && (
              <button onClick={() => setConfirmDelete({ open: true, id: -1, name: `${selectedIds.size} selected files` })} className="text-xs py-1.5 px-3 rounded-lg font-medium bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 transition-colors">Delete Selected</button>
            )}
          </div>
          <button onClick={() => setSelectedIds(new Set())} aria-label="Clear selection" className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors" title="Clear selection">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg" style={{ height: 48, marginBottom: 8 }} />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Files size={28} className="text-amber-400" />}
              title={search ? 'No files match your search' : 'No files yet'}
              description={search ? 'Try a different search term or clear your filters.' : 'Upload your first file to get started.'}
              action={!search ? <button className="btn-primary" onClick={() => setShowBulkUpload(true)}>Upload File</button> : undefined}
            />
          </div>
        ) : viewMode === 'grouped' ? (
          <div className="p-4 space-y-4">
            {(() => {
              const groups: Record<string, any[]> = {};
              files.forEach(f => {
                const key = f.project || 'No Project';
                if (!groups[key]) groups[key] = [];
                groups[key].push(f);
              });
              return Object.entries(groups).map(([project, projectFiles]) => (
                <div key={project}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{project}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-600">({projectFiles.length})</span>
                  </div>
                  <div className="space-y-1">
                    {projectFiles.map(f => (
                      <div
                        key={f.id}
                        onClick={() => openFile(f)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                      >
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={20} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{f.name}</div>
                          <div className="text-xs text-slate-400">{f.module || f.category || '—'} · v{f.version}</div>
                        </div>
                        <StatusBadge status={f.status} />
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-table>
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      aria-label="Select all files"
                      className="rounded border-slate-300 dark:border-slate-600 text-amber-500 focus:ring-amber-500"
                    />
                  </th>
                  {['File', 'Project / Module', 'Version', 'Status', 'Owner', 'Jira', 'Size', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map((f, index) => (
                  <tr key={f.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedIds.has(f.id) ? 'bg-amber-500/5' : ''}`} style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${index * 0.03}s`, transition: 'background 0.15s ease' }}>
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(f.id)}
                        onChange={() => toggleOne(f.id)}
                        onClick={e => e.stopPropagation()}
                        aria-label={`Select ${f.name}`}
                        className="rounded border-slate-300 dark:border-slate-600 text-amber-500 focus:ring-amber-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900 dark:text-slate-100 truncate" title={f.name}>{f.name}</span>
                            {f.checked_out_by && (
                              <span title={`Checked out by ${f.checked_out_by_name || 'someone'}`}>
                                <Lock size={12} className={f.checked_out_by === user?.id ? 'text-amber-500' : 'text-red-500'} />
                              </span>
                            )}
                          </div>
                          <div className="text-xs truncate" title={f.original_name}>
                            {f.checked_out_by ? (
                              <span className={f.checked_out_by === user?.id ? 'text-amber-500' : 'text-red-500'}>
                                {f.checked_out_by === user?.id ? 'You (editing)' : `Locked by ${f.checked_out_by_name}`}
                              </span>
                            ) : (
                              <span className="text-slate-400">{f.original_name}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      <div className="font-medium text-slate-700 dark:text-slate-300">{f.project}</div>
                      <div>{f.module}</div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 font-mono">v{f.version}</span></td>
                    <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{f.owner_name}</td>
                    <td className="px-4 py-3">
                      {f.jira_ticket && <span className="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">{f.jira_ticket}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatBytes(f.size)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString('en-CA')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFile(f)} title="Details" aria-label="View file details" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" disabled={fileDetailLoading}>
                          {fileDetailLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
                        </button>
                        {isPreviewable(f) && (
                          <button onClick={() => openPreview(f)} title="Preview" aria-label="Preview file" className="p-1.5 rounded hover:bg-amber-500/10 text-amber-500">
                            {f.mime_type?.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                          </button>
                        )}
                        <button onClick={() => downloadFile(f.id, f.original_name)} title="Download" aria-label="Download file" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Download size={14} /></button>
                        {/* Check-out / Check-in buttons */}
                        {!f.checked_out_by && (isLead || isEngineer) && (
                          <button onClick={() => doCheckout(f.id)} title="Check Out" aria-label="Check out file" className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-500">
                            <Lock size={14} />
                          </button>
                        )}
                        {f.checked_out_by === user?.id && (
                          <button onClick={() => doCheckin(f.id)} title="Check In" aria-label="Check in file" className="p-1.5 rounded hover:bg-emerald-500/10 text-amber-500 hover:text-emerald-500">
                            <Unlock size={14} />
                          </button>
                        )}
                        {f.checked_out_by && f.checked_out_by !== user?.id && isLead && (
                          <button onClick={() => doCheckin(f.id)} title="Force Check In" aria-label="Force check in file" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                            <Unlock size={14} />
                          </button>
                        )}
                        {isLead ? (
                          <>
                            <button onClick={() => { setSelected(f); setShowApprove(true); }} title="Review" aria-label="Review file" className="p-1.5 rounded hover:bg-amber-500/10 text-amber-500">
                              <GitBranch size={14} />
                            </button>
                            <button onClick={() => setConfirmArchive({ open: true, id: f.id, name: f.name })} title="Archive" aria-label="Archive file" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Archive size={14} /></button>
                          </>
                        ) : isEngineer && f.owner_id === user?.id ? (
                          <button onClick={() => setConfirmArchive({ open: true, id: f.id, name: f.name })} title="Archive" aria-label="Archive file" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Archive size={14} /></button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 pb-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Pagination
            total={fileTotal}
            limit={FILE_LIMIT}
            offset={fileOffset}
            onPageChange={off => { setFileOffset(off); load({ offset: off }); }}
          />
        </div>
      </div>

      {/* File Detail Modal */}
      {selected && !showApprove && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="File Details" size="lg">
          <div className="space-y-4">
            {/* File header */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <FileIcon mimeType={selected.mime_type} name={selected.original_name} size={36} />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                <p className="text-sm text-slate-500">{selected.original_name} · {formatBytes(selected.size)}</p>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            {/* Preview */}
            {(selected.mime_type?.startsWith('image/') || selected.mime_type === 'application/pdf') && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {selected.mime_type?.startsWith('image/') ? (
                  <img
                    src={`/api/files/${selected.id}/preview`}
                    alt={selected.name}
                    className="w-full max-h-80 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <iframe
                    src={`/api/files/${selected.id}/preview`}
                    className="w-full h-80"
                    title={selected.name}
                  />
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
              {(['details', 'comments', 'approvals'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleDetailTabChange(t)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${detailTab === t ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                  {t === 'approvals' ? 'Approval History' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {/* Details tab */}
            {detailTab === 'details' && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {([
                    ['Project', selected.project], ['Module', selected.module], ['Category', selected.category],
                    ['Version', `v${selected.version}`], ['Owner', selected.owner_name], ['Repository', selected.repository_name],
                    ['Jira Ticket', selected.jira_ticket], ['Tags', selected.tags],
                  ] as [string, string][]).map(([l, v]) => v ? (
                    <div key={l}>
                      <span className="text-slate-500 dark:text-slate-400">{l}: </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{v}</span>
                    </div>
                  ) : null)}
                </div>
                {selected.description && <div className="text-sm text-slate-600 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">{selected.description}</div>}

                {selected.versions?.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 mb-2">Version History</h4>
                    <div className="space-y-2">
                      {selected.versions.map((v: any) => (
                        <div key={v.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                          <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-mono">v{v.version}</span>
                          <span className="text-slate-500">{v.change_log}</span>
                          <span className="ml-auto text-xs text-slate-400">{v.created_by_name} · {new Date(v.created_at).toLocaleDateString('en-CA')}</span>
                          <button onClick={() => downloadFile(selected.id, selected.original_name, `/api/files/${selected.id}/versions/${v.version}/download`)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400" title="Download this version" aria-label={`Download version ${v.version}`}><Download size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  {isPreviewable(selected) && (
                    <button onClick={() => { setSelected(null); openPreview(selected); }} className="btn-secondary"><Eye size={15} /> Preview</button>
                  )}
                  <button onClick={() => downloadFile(selected.id, selected.original_name)} className="btn-secondary"><Download size={15} /> Download</button>
                  {isLead && selected.status !== 'published' && selected.status !== 'archived' && (
                    <button onClick={() => setShowApprove(true)} className="btn-primary">Review / Approve</button>
                  )}
                  {selected.status === 'archived' && isLead && (
                    <button onClick={() => { doRestore(selected.id); setSelected(null); }} className="btn-primary">
                      <RotateCcw size={15} /> Restore
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Comments tab */}
            {detailTab === 'comments' && (
              <div className="space-y-3">
                {commentLoading && comments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <Loader2 size={20} className="animate-spin text-amber-400" />
                    Loading comments…
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <MessageSquare size={28} className="opacity-30" />
                    No comments yet. Be the first to comment.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                        {c.user_avatar ? (
                          <img src={c.user_avatar} alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(c.user_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.user_name}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                              {(c.user_id === user?.id || isAdmin) && (
                                <button onClick={() => deleteComment(c.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Delete comment">
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex gap-2">
                    <input
                      value={newComment}
                      onChange={e => { setNewComment(e.target.value.slice(0, 500)); if (commentError) setCommentError(''); }}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && postComment()}
                      placeholder="Add a comment…"
                      className={`input flex-1 text-sm ${commentError ? 'border-red-400 focus:ring-red-300' : ''}`}
                      maxLength={500}
                    />
                    <button onClick={postComment} disabled={commentLoading} className="btn-primary px-4">Post</button>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    {commentError ? <p className="text-xs text-red-500">{commentError}</p> : <span />}
                    <p className="text-xs text-slate-400 text-right">{newComment.length}/500</p>
                  </div>
                </div>
              </div>
            )}

            {/* Approval History tab */}
            {detailTab === 'approvals' && (
              <div className="space-y-2">
                {approvalHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                    <CheckCircle size={28} className="opacity-30" />
                    No approval history yet.
                  </div>
                ) : (
                  <div className="relative pl-4">
                    <div className="absolute left-[7px] top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" />
                    <div className="space-y-4">
                      {approvalHistory.map((a: any) => (
                        <div key={a.id} className="relative flex gap-3">
                          <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 border-2 border-white dark:border-slate-900 ${APPROVAL_DOT[a.status] || 'bg-slate-400'}`} />
                          <div className="flex-1 min-w-0 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                            <div className="flex items-center gap-2 flex-wrap">
                              {a.reviewer_avatar ? (
                                <img src={a.reviewer_avatar} alt="" className="w-6 h-6 rounded-full" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                                  {(a.reviewer_name || '?')[0].toUpperCase()}
                                </div>
                              )}
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{a.reviewer_name}</span>
                              <StatusBadge status={a.status} />
                              <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
                                <Clock size={10} /> {new Date(a.created_at).toLocaleDateString('en-CA')}
                              </span>
                            </div>
                            {a.comments && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{a.comments}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve Modal */}
      <Modal open={showApprove} onClose={() => { setShowApprove(false); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); }} title="Review File" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Update Status</label>
            <select value={approveStatus} onChange={e => { setApproveStatus(e.target.value); setApproveError(''); }} className="input">
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="draft">Return to Draft</option>
            </select>
          </div>
          <div>
            <label className="label">Comments{requiresComment && <span className="text-red-500 ml-0.5">*</span>}</label>
            <textarea value={approveComment} onChange={e => { setApproveComment(e.target.value.slice(0, 1000)); if (approveError) setApproveError(''); }} className={`input ${approveError ? 'border-red-400 focus:ring-red-300' : ''}`} rows={3} placeholder={requiresComment ? 'Explain why you are returning/rejecting this file…' : 'Add review comments…'} maxLength={1000} />
            <p className="text-xs text-slate-400 text-right mt-0.5">{approveComment.length}/1000</p>
            {approveError && <p className="text-xs text-red-500 mt-1">{approveError}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowApprove(false); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); }} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} className="btn-primary">Update Status</button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showBulkUpload} onClose={() => { if (!bulkUploading) { setShowBulkUpload(false); setBulkFiles([]); setBulkProgress(''); } }} title="Bulk Upload Files" size="md">
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-slate-200 dark:border-slate-700 hover:border-amber-500/50'}`}
          >
            <Upload size={28} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop files here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Up to 20 files, max 50 MB each</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addBulkFiles(Array.from(e.target.files || []))} />
          </div>

          {bulkFiles.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {bulkFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                  <FileIcon mimeType={f.type} name={f.name} size={16} />
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{f.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                  <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-400 transition-colors"><X size={13} /></button>
                </div>
              ))}
            </div>
          )}

          {bulkProgress && (
            <p className={`text-sm text-center font-medium ${bulkProgress.includes('complete') ? 'text-amber-500' : bulkProgress.includes('fail') ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
              {bulkProgress}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { if (!bulkUploading) { setShowBulkUpload(false); setBulkFiles([]); setBulkProgress(''); } }} disabled={bulkUploading} className="btn-secondary">Cancel</button>
            <button onClick={doBulkUpload} disabled={!bulkFiles.length || bulkUploading} className="btn-primary">
              {bulkUploading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={15} />}
              Upload {bulkFiles.length > 0 ? `${bulkFiles.length} File${bulkFiles.length > 1 ? 's' : ''}` : 'Files'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, name: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete File"
        message={`"${confirmDelete.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={actionLoading}
      />

      {/* Confirm Archive Modal */}
      <Modal open={confirmArchive.open} onClose={() => setConfirmArchive({ open: false, id: null, name: '' })} title="Archive File" size="md">
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 mb-5">
          <Archive size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>"{confirmArchive.name}"</strong> will be moved to the Archive. It will no longer appear in File Manager and can only be restored from the Archive module.
          </p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <button onClick={doArchive} disabled={archiveLoading} className="btn-primary w-full justify-center flex items-center gap-1.5">
            {archiveLoading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Archive size={14} />}
            Archive
          </button>
          <button onClick={() => setConfirmArchive({ open: false, id: null, name: '' })} disabled={archiveLoading} className="btn-secondary w-full justify-center">Cancel</button>
        </div>
      </Modal>

      {/* Archive Success Modal */}
      <Modal open={archiveSuccess} onClose={() => setArchiveSuccess(false)} title="File Archived" size="md">
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
              <Archive size={28} className="text-amber-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 text-center">
              The file has been archived successfully.<br />
              You can restore it anytime from the <span className="font-semibold text-slate-800 dark:text-slate-100">Archive</span> module.
            </p>
          </div>
          <div className="flex justify-center">
            <button onClick={() => setArchiveSuccess(false)} className="btn-primary px-8">Done</button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      {previewFile && (
        <Modal open={showPreview} onClose={() => { setShowPreview(false); setPreviewFile(null); }} title={`Preview: ${previewFile.name || previewFile.original_name}`} size="lg">
          <div className="flex flex-col items-center gap-4">
            {previewLoading ? (
              <div className="flex items-center justify-center h-40">
                <Loader2 size={28} className="animate-spin text-amber-400" />
              </div>
            ) : previewFile?.mime_type?.startsWith('image/') && previewBlobUrl ? (
              <img src={previewBlobUrl} alt={previewFile.name} className="max-w-full max-h-[60vh] rounded-lg object-contain" />
            ) : previewFile?.mime_type === 'application/pdf' && previewBlobUrl ? (
              <iframe src={previewBlobUrl} className="w-full h-[60vh] rounded-lg border border-slate-200 dark:border-slate-700" title="PDF Preview" />
            ) : !previewLoading ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                <FileText size={32} className="opacity-30" />
                <p className="text-sm">Preview not available</p>
              </div>
            ) : null}
            <div className="flex gap-2">
              <button onClick={() => downloadFile(previewFile.id, previewFile.original_name)} className="btn-secondary"><Download size={15} /> Download</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
