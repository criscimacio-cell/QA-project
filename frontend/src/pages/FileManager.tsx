import { useState, useEffect, useRef } from 'react';
import { Filter, Download, Archive, Eye, GitBranch, RefreshCw, Upload, X, RotateCcw, FileText, Image } from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

async function downloadFile(fileId: number, filename: string, versionPath?: string) {
  const url = versionPath || `/api/files/${fileId}/download`;
  const token = localStorage.getItem('token');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) { alert('Download failed — file not found on disk.'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

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
    api.get('/files', { params }).then(r => setFiles(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [tab, project, category]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); load(); };

  const requiresComment = approveStatus === 'rejected' || approveStatus === 'draft';

  const doApprove = async () => {
    if (!selected) return;
    if (requiresComment && approveComment.trim().length < 10) {
      setApproveError('Please provide a reason (min 10 characters)');
      return;
    }
    try {
      await api.post(`/files/${selected.id}/approve`, { status: approveStatus, comments: approveComment });
      setShowApprove(false); setSelected(null); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); load();
    } catch (err: any) {
      setApproveError(err?.response?.data?.error || 'Failed to update status');
    }
  };

  const doArchive = async (id: number) => {
    await api.post(`/files/${id}/archive`);
    load();
  };

  const doRestore = async (id: number) => {
    await api.post(`/files/${id}/restore`);
    load();
  };

  const openFile = async (f: any) => {
    const r = await api.get(`/files/${f.id}`);
    setSelected(r.data);
  };

  const openPreview = (f: any) => {
    setPreviewFile(f);
    setShowPreview(true);
  };

  const isPreviewable = (f: any) =>
    f?.mime_type?.startsWith('image/') || f?.mime_type === 'application/pdf';

  // Bulk upload handlers
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    setBulkFiles(prev => [...prev, ...dropped]);
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
      setTimeout(() => {
        setShowBulkUpload(false);
        setBulkFiles([]);
        setBulkProgress('');
        load();
      }, 1200);
    } catch (e: any) {
      setBulkProgress(e.response?.data?.error || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const projects = [...new Set(files.map(f => f.project).filter(Boolean))];
  const categories = [...new Set(files.map(f => f.category).filter(Boolean))];

  const token = localStorage.getItem('token');
  const previewUrl = previewFile
    ? `${(api.defaults.baseURL || '/api')}${previewFile.id ? `/files/${previewFile.id}/preview` : ''}`
    : '';

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">File Manager</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage all QA files and assets</p>
        </div>
        <button onClick={() => setShowBulkUpload(true)} className="btn-primary">
          <Upload size={15} /> Bulk Upload
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-slate-400" />
        <form onSubmit={handleSearch} className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, tags, Jira…" className="input h-8 text-sm w-64" />
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
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><RefreshCw size={20} className="animate-spin text-[#F59E0B]" /></div>
        ) : files.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No files found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  {['File', 'Project / Module', 'Version', 'Status', 'Owner', 'Jira', 'Size', 'Updated', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-[220px]">
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={18} />
                        <div>
                          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</div>
                          <div className="text-xs text-slate-400 truncate">{f.original_name}</div>
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
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(f.updated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openFile(f)} title="Details" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Eye size={14} /></button>
                        {isPreviewable(f) && (
                          <button onClick={() => openPreview(f)} title="Preview" className="p-1.5 rounded hover:bg-[#F59E0B]/10 text-[#F59E0B]">
                            {f.mime_type?.startsWith('image/') ? <Image size={14} /> : <FileText size={14} />}
                          </button>
                        )}
                        <button onClick={() => downloadFile(f.id, f.original_name)} title="Download" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Download size={14} /></button>
                        {f.status === 'archived' ? (
                          <button onClick={() => doRestore(f.id)} title="Restore" className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500"><RotateCcw size={14} /></button>
                        ) : isLead ? (
                          <>
                            <button onClick={() => { setSelected(f); setShowApprove(true); }} title="Review" className="p-1.5 rounded hover:bg-[#F59E0B]/10 text-[#F59E0B]">
                              <GitBranch size={14} />
                            </button>
                            <button onClick={() => doArchive(f.id)} title="Archive" className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400"><Archive size={14} /></button>
                          </>
                        ) : null}
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
      {selected && !showApprove && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="File Details" size="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <FileIcon mimeType={selected.mime_type} name={selected.original_name} size={36} />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                <p className="text-sm text-slate-500">{selected.original_name} · {formatBytes(selected.size)}</p>
                <StatusBadge status={selected.status} />
              </div>
            </div>
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
                      <span className="text-xs bg-[#F59E0B]/10 text-[#F59E0B] px-2 py-0.5 rounded font-mono">v{v.version}</span>
                      <span className="text-slate-500">{v.change_log}</span>
                      <span className="ml-auto text-xs text-slate-400">{v.created_by_name} · {new Date(v.created_at).toLocaleDateString()}</span>
                      <button onClick={() => downloadFile(selected.id, selected.original_name, `/api/files/${selected.id}/versions/${v.version}/download`)} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400" title="Download this version"><Download size={12} /></button>
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
              {selected.status === 'archived' && (
                <button onClick={() => { doRestore(selected.id); setSelected(null); }} className="btn-primary">
                  <RotateCcw size={15} /> Restore
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Modal */}
      <Modal open={showApprove} onClose={() => { setShowApprove(false); setSelected(null); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); }} title="Review File" size="sm">
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
            <textarea value={approveComment} onChange={e => { setApproveComment(e.target.value); if (approveError) setApproveError(''); }} className={`input ${approveError ? 'border-red-400 focus:ring-red-300' : ''}`} rows={3} placeholder={requiresComment ? 'Explain why you are returning/rejecting this file…' : 'Add review comments…'} />
            {approveError && <p className="text-xs text-red-500 mt-1">{approveError}</p>}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowApprove(false); setSelected(null); setApproveComment(''); setApproveStatus('approved'); setApproveError(''); }} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} className="btn-primary">Update Status</button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal open={showBulkUpload} onClose={() => { setShowBulkUpload(false); setBulkFiles([]); setBulkProgress(''); }} title="Bulk Upload Files" size="md">
        <div className="space-y-4">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-[#F59E0B] bg-[#F59E0B]/5' : 'border-slate-200 dark:border-slate-700 hover:border-[#F59E0B]/50'}`}
          >
            <Upload size={28} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Drop files here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Up to 20 files, max 50 MB each</p>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => setBulkFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
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
            <p className={`text-sm text-center font-medium ${bulkProgress.includes('complete') ? 'text-[#F59E0B]' : bulkProgress.includes('fail') ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
              {bulkProgress}
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowBulkUpload(false); setBulkFiles([]); setBulkProgress(''); }} className="btn-secondary">Cancel</button>
            <button onClick={doBulkUpload} disabled={!bulkFiles.length || bulkUploading} className="btn-primary">
              {bulkUploading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={15} />}
              Upload {bulkFiles.length > 0 ? `${bulkFiles.length} File${bulkFiles.length > 1 ? 's' : ''}` : 'Files'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Preview Modal */}
      {previewFile && (
        <Modal open={showPreview} onClose={() => { setShowPreview(false); setPreviewFile(null); }} title={`Preview: ${previewFile.name || previewFile.original_name}`} size="lg">
          <div className="flex flex-col items-center gap-4">
            {previewFile.mime_type?.startsWith('image/') ? (
              <img
                src={`/api/files/${previewFile.id}/preview`}
                alt={previewFile.name}
                className="max-w-full max-h-[60vh] rounded-lg object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : previewFile.mime_type === 'application/pdf' ? (
              <iframe
                src={`/api/files/${previewFile.id}/preview`}
                className="w-full h-[60vh] rounded-lg border border-slate-200 dark:border-slate-700"
                title="PDF Preview"
              />
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
