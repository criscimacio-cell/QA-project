import { useState, useEffect } from 'react';
import { GitPullRequest, CheckCircle, XCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

const STAGES = [
  { key: 'draft', label: 'Draft', icon: FileText, color: 'border-slate-300 dark:border-slate-600', headerColor: 'bg-slate-100 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400' },
  { key: 'submitted', label: 'Submitted', icon: ArrowRight, color: 'border-blue-300 dark:border-blue-700', headerColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'under_review', label: 'Under Review', icon: Clock, color: 'border-amber-300 dark:border-amber-700', headerColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'border-teal-300 dark:border-teal-700', headerColor: 'bg-teal-50 dark:bg-teal-900/20', textColor: 'text-teal-600 dark:text-teal-400' },
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

  const load = () => api.get('/files').then(r => setFiles(r.data.filter((f: any) => f.status !== 'archived')));
  useEffect(() => { load(); }, []);

  const getFilesForStage = (stage: string) => files.filter(f => f.status === stage);

  const doApprove = async () => {
    const target = approveTarget || selected;
    if (!target) return;
    await api.post(`/files/${target.id}/approve`, { status: newStatus, comments: comment });
    setApproveModal(false); setApproveTarget(null); setSelected(null); setComment(''); load();
  };

  const quickMove = async (f: any, status: string) => {
    await api.post(`/files/${f.id}/approve`, { status, comments: '' });
    load();
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Approval Workflow</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage file review and publication pipeline</p>
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
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map(stage => {
          const stageFiles = getFilesForStage(stage.key);
          return (
            <div key={stage.key} className={`flex-shrink-0 w-64 border-2 ${stage.color} rounded-xl overflow-hidden`}>
              <div className={`${stage.headerColor} px-4 py-3 flex items-center gap-2`}>
                <stage.icon size={16} className={stage.textColor} />
                <span className={`font-semibold text-sm ${stage.textColor}`}>{stage.label}</span>
                <span className="ml-auto text-xs bg-white dark:bg-slate-900 rounded-full px-2 py-0.5 font-bold text-slate-700 dark:text-slate-300">{stageFiles.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto bg-white dark:bg-slate-900">
                {stageFiles.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">No files</div>
                ) : stageFiles.map(f => (
                  <div key={f.id} className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:shadow-sm cursor-pointer transition-all" onClick={() => setSelected(f)}>
                    <div className="flex items-center gap-2 mb-2">
                      <FileIcon mimeType={f.mime_type} name={f.original_name} size={16} />
                      <span className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-0.5">
                      <div>{f.project} · {f.module}</div>
                      {f.jira_ticket && <div className="text-blue-500 font-mono">{f.jira_ticket}</div>}
                      <div>{f.owner_name}</div>
                    </div>
                    {isLead && (
                      <div className="flex gap-1 mt-2">
                        {stage.key === 'submitted' && (
                          <button onClick={e => { e.stopPropagation(); quickMove(f, 'under_review'); }} className="flex-1 text-xs py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-200 font-medium">Review</button>
                        )}
                        {stage.key === 'under_review' && (
                          <>
                            <button onClick={e => { e.stopPropagation(); quickMove(f, 'approved'); }} className="flex-1 text-xs py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-lg hover:bg-teal-200 font-medium">Approve</button>
                            <button onClick={e => { e.stopPropagation(); quickMove(f, 'draft'); }} className="flex-1 text-xs py-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100 font-medium">Reject</button>
                          </>
                        )}
                        {stage.key === 'approved' && (
                          <button onClick={e => { e.stopPropagation(); quickMove(f, 'published'); }} className="flex-1 text-xs py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 font-medium">Publish</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
                <div key={l}><span className="text-slate-400">{l}: </span><span className="font-medium text-slate-900 dark:text-slate-100">{v}</span></div>
              ))}
            </div>
            {isLead && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => { setApproveTarget(selected); setSelected(null); setApproveModal(true); }} className="btn-primary w-full justify-center">Update Status</button>
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
            <label className="label">Comment</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} className="input" rows={3} placeholder="Add a review comment..." />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setApproveModal(false); setApproveTarget(null); setNewStatus('approved'); setComment(''); }} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} className="btn-primary">Update</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
