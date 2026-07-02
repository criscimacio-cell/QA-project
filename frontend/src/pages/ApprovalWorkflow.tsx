import { useState, useEffect, useRef } from 'react';
import { CheckCircle, Clock, FileText, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '../components/UI/Pagination';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 10;

const STAGES = [
  { key: 'draft', label: 'Draft', icon: FileText, color: 'border-slate-300 dark:border-slate-600', headerColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400' },
  { key: 'submitted', label: 'Submitted', icon: ArrowRight, color: 'border-blue-300 dark:border-blue-700', headerColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'under_review', label: 'Under Review', icon: Clock, color: 'border-amber-300 dark:border-amber-700', headerColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'border-emerald-300 dark:border-emerald-700', headerColor: 'bg-emerald-100/60 dark:bg-emerald-900/20', textColor: 'text-emerald-600 dark:text-emerald-300' },
  { key: 'published', label: 'Published', icon: CheckCircle, color: 'border-emerald-300 dark:border-emerald-700', headerColor: 'bg-emerald-50 dark:bg-emerald-900/20', textColor: 'text-emerald-600 dark:text-emerald-400' },
];

export default function ApprovalWorkflow() {
  const { isLead } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [approveModal, setApproveModal] = useState(false);
  const [newStatus, setNewStatus] = useState('approved');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [approveLoading, setApproveLoading] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [droppingId, setDroppingId] = useState<number | null>(null);

  // Per-column pagination offsets
  const [colOffsets, setColOffsets] = useState<Record<string, number>>({});

  // Drag state
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);
  const dragFile = useRef<any>(null);
  // Per-column drag counter to avoid flicker from child dragLeave events
  const dragCounters = useRef<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/files');
      setFiles(r.data.filter((f: any) => f.status !== 'archived'));
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const getFilesForStage = (stage: string) => files.filter(f => f.status === stage);

  const doApprove = async () => {
    const target = approveTarget || selected;
    if (!target) return;
    if (newStatus === 'draft' && comment.trim().length < 10) {
      toast.error('Please provide a rejection reason (min 10 characters)');
      return;
    }
    setApproveLoading(true);
    try {
      await api.post(`/files/${target.id}/approve`, { status: newStatus, comments: comment });
      toast.success('Status updated successfully');
      setApproveModal(false); setApproveTarget(null); setSelected(null); setNewStatus('approved'); setComment('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update status');
    } finally {
      setApproveLoading(false);
    }
  };

  const quickMove = async (f: any, status: string) => {
    if (movingId === f.id) return; // prevent double-submit
    setMovingId(f.id);
    try {
      await api.post(`/files/${f.id}/approve`, { status, comments: '' });
      toast.success(`Moved to ${STAGES.find(s => s.key === status)?.label || status}`);
      setFlashId(f.id);
      setTimeout(() => setFlashId(null), 700);
      load();
    } catch {
      toast.error('Failed to move file. Please try again.');
      load();
    } finally {
      setMovingId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, f: any) => {
    if (!isLead) return;
    dragFile.current = f;
    setDraggingId(f.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverStage(null);
    dragFile.current = null;
    dragCounters.current = {};
  };

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageKey);
  };

  const handleDrop = async (e: React.DragEvent, stageKey: string) => {
    e.preventDefault();
    const f = dragFile.current;
    if (!f || f.status === stageKey) { handleDragEnd(); return; }
    setDraggingId(null);
    setDragOverStage(null);
    dragFile.current = null;
    dragCounters.current = {};
    setDroppingId(f.id);
    // Optimistic update
    setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: stageKey } : x));
    setFlashId(f.id);
    setTimeout(() => setFlashId(null), 700);
    try {
      await api.post(`/files/${f.id}/approve`, { status: stageKey, comments: '' });
      load();
    } catch {
      load();
      toast.error('Failed to move file. Please try again.');
    } finally {
      setDroppingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Workflow</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage file review and publication pipeline
          <span className="hidden sm:inline"> · <span className="text-amber-500 font-medium">Drag cards between columns to move files</span></span>
        </p>
      </div>

      {/* Pipeline stats */}
      <div className="flex gap-3 flex-wrap">
        {STAGES.map(s => {
          const count = getFilesForStage(s.key).length;
          return (
            <div key={s.key} className={`card px-4 py-3 flex items-center gap-2 ${count > 0 ? 'border-2 ' + s.color : ''}`}>
              <s.icon size={16} className={s.textColor} />
              <span className={`font-semibold text-sm ${s.textColor}`}>{count}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="shimmer-bg h-8 rounded-lg" />
              <div className="shimmer-bg h-24 rounded-xl" />
              <div className="shimmer-bg h-24 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" tabIndex={0} role="region" aria-label="Approval workflow board, scroll horizontally to see all stages">
          {STAGES.map(stage => {
            const stageFiles = getFilesForStage(stage.key);
            const colOffset = colOffsets[stage.key] || 0;
            const pagedFiles = stageFiles.slice(colOffset, colOffset + PAGE_SIZE);
            const isOver = dragOverStage === stage.key;
            const isDragSource = draggingId !== null && stageFiles.some(f => f.id === draggingId);

            return (
              <div
                key={stage.key}
                role="region"
                aria-label={`${stage.label} column`}
                className={`flex-shrink-0 w-64 border-2 rounded-xl overflow-hidden transition-all duration-150 ${
                  isOver
                    ? stage.color + ' ring-2 ring-offset-1 ring-amber-500 scale-[1.01]'
                    : stage.color
                }`}
                onDragOver={e => handleDragOver(e, stage.key)}
                onDragEnter={() => {
                  dragCounters.current[stage.key] = (dragCounters.current[stage.key] || 0) + 1;
                  setDragOverStage(stage.key);
                }}
                onDragLeave={() => {
                  dragCounters.current[stage.key] = (dragCounters.current[stage.key] || 0) - 1;
                  if (dragCounters.current[stage.key] <= 0) {
                    dragCounters.current[stage.key] = 0;
                    setDragOverStage(null);
                  }
                }}
                onDrop={e => handleDrop(e, stage.key)}
              >
                <div className={`${stage.headerColor} px-4 py-3 flex items-center gap-2`}>
                  <stage.icon size={16} className={stage.textColor} />
                  <span className={`font-semibold text-sm ${stage.textColor}`}>{stage.label}</span>
                  <span className="ml-auto text-xs bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 font-bold text-slate-700 dark:text-slate-300">{stageFiles.length}</span>
                </div>

                <div
                  className={`p-2 space-y-2 min-h-[80px] max-h-[500px] overflow-y-auto transition-colors duration-150 ${
                    isOver
                      ? 'bg-emerald-50/60 dark:bg-emerald-900/10'
                      : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Drop hint */}
                  {isOver && draggingId !== null && !stageFiles.some(f => f.id === draggingId) && (
                    <div className="border-2 border-dashed border-amber-400 rounded-xl h-16 flex items-center justify-center text-xs text-amber-500 font-medium animate-pulse">
                      Drop here → {stage.label}
                    </div>
                  )}

                  {stageFiles.length === 0 && !isOver ? (
                    <div className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
                      {draggingId !== null ? (
                        <span className="text-amber-500 font-medium">Drop here</span>
                      ) : 'No files'}
                    </div>
                  ) : pagedFiles.map((f, cardIdx) => (
                    <div
                      key={f.id}
                      role="article"
                      aria-label={`${f.name} - ${f.status}`}
                      draggable={isLead}
                      onDragStart={e => handleDragStart(e, f)}
                      onDragEnd={handleDragEnd}
                      className={`p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing select-none ${
                        draggingId === f.id
                          ? 'opacity-40 scale-95 bg-slate-100 dark:bg-slate-700'
                          : droppingId === f.id
                          ? 'opacity-60 ring-2 ring-amber-500 bg-slate-50 dark:bg-slate-800'
                          : 'bg-slate-50 dark:bg-slate-800 hover:shadow-md hover:scale-[1.01]'
                      }`}
                      style={{
                        animation: flashId === f.id
                          ? 'flashAmber 0.6s ease-out both'
                          : `rowStagger 0.28s ease both`,
                        animationDelay: flashId === f.id ? '0s' : `${cardIdx * 0.03}s`,
                      }}
                      onClick={async () => {
                        if (draggingId !== null) return;
                        try {
                          const r = await api.get(`/files/${f.id}`);
                          setSelected(r.data);
                        } catch {
                          toast.error('Failed to load file details');
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* Drag handle — only visible to leads who can actually drag */}
                        {isLead && (
                          <div className="flex flex-col gap-[3px] opacity-30 flex-shrink-0">
                            <div className="flex gap-[3px]">
                              <div className="w-1 h-1 rounded-full bg-slate-500" />
                              <div className="w-1 h-1 rounded-full bg-slate-500" />
                            </div>
                            <div className="flex gap-[3px]">
                              <div className="w-1 h-1 rounded-full bg-slate-500" />
                              <div className="w-1 h-1 rounded-full bg-slate-500" />
                            </div>
                          </div>
                        )}
                        <FileIcon mimeType={f.mime_type} name={f.original_name} size={16} />
                        <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <div>{f.project} · {f.module}</div>
                        {f.jira_ticket && <div className="text-blue-500 font-mono">{f.jira_ticket}</div>}
                        <div>{f.owner_name}</div>
                      </div>
                      {isLead && (
                        <div className="flex gap-1 mt-2">
                          {stage.key === 'submitted' && (
                            <button aria-label={`Move ${f.name} to Under Review`} onClick={e => { e.stopPropagation(); quickMove(f, 'under_review'); }} disabled={movingId === f.id} className="flex-1 text-xs py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 font-medium">
                              {movingId === f.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Review'}
                            </button>
                          )}
                          {stage.key === 'under_review' && (
                            <>
                              <button aria-label={`Approve ${f.name}`} onClick={e => { e.stopPropagation(); quickMove(f, 'approved'); }} disabled={movingId === f.id} className="flex-1 text-xs py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-200 font-medium">
                                {movingId === f.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Approve'}
                              </button>
                              <button aria-label={`Reject ${f.name}`} onClick={e => { e.stopPropagation(); setApproveTarget(f); setNewStatus('draft'); setComment(''); setApproveModal(true); }} className="flex-1 text-xs py-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100 font-medium">Reject</button>
                            </>
                          )}
                          {stage.key === 'approved' && (
                            <button aria-label={`Publish ${f.name}`} onClick={e => { e.stopPropagation(); quickMove(f, 'published'); }} disabled={movingId === f.id} className="flex-1 text-xs py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 font-medium">
                              {movingId === f.id ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Publish'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {stageFiles.length > PAGE_SIZE && (
                  <div className="px-2 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <Pagination
                      total={stageFiles.length}
                      limit={PAGE_SIZE}
                      offset={colOffset}
                      onPageChange={newOffset => setColOffsets(prev => ({ ...prev, [stage.key]: newOffset }))}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* File detail modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title="File Details" size="md">
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <FileIcon mimeType={selected.mime_type} name={selected.original_name} size={28} />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{selected.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{selected.project} · {selected.module} · v{selected.version}</p>
              </div>
            </div>
            {selected.description && <p className="text-sm text-slate-600 dark:text-slate-300">{selected.description}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[['Owner', selected.owner_name], ['Category', selected.category], ['Jira', selected.jira_ticket], ['Repository', selected.repository_name]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><span className="text-slate-500">{l}: </span><span className="font-medium text-slate-900 dark:text-slate-100">{v}</span></div>
              ))}
            </div>
            {isLead && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { setApproveTarget(selected); setSelected(null); setNewStatus('approved'); setComment(''); setApproveModal(true); }} className="btn-primary w-full justify-center" onMouseDown={e => e.currentTarget.style.animation = 'springBounce 0.38s cubic-bezier(0.34,1.5,0.64,1) both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>Update Status</button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve modal */}
      <Modal open={approveModal} onClose={() => { setApproveModal(false); setApproveTarget(null); setNewStatus('approved'); setComment(''); }} title="Update File Status" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">New Status</label>
            <select value={newStatus} onChange={e => setNewStatus(e.target.value)} className="input">
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="draft">Return to Draft</option>
            </select>
          </div>
          <div>
            <label className="label">Comment{newStatus === 'draft' && <span className="text-red-500 ml-0.5">*</span>}</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value.slice(0, 2000))}
              maxLength={2000}
              className="input"
              rows={3}
              placeholder={newStatus === 'draft' ? 'Explain why you are returning this file to draft… (required)' : 'Add a review comment...'}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 text-right mt-0.5">{comment.length}/2000</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setApproveModal(false); setApproveTarget(null); setNewStatus('approved'); setComment(''); }} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} disabled={approveLoading} className="btn-primary">
              {approveLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Update
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
