import { useState, useEffect } from 'react';
import { GitPullRequest, CheckCircle, XCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import api from '../api/client';
import FileIcon from '../components/UI/FileIcon';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

const STAGES = [
  { key: 'draft', label: 'Draft', icon: FileText, color: 'border-gray-300 dark:border-gray-600', headerColor: 'bg-gray-100 dark:bg-gray-800', textColor: 'text-gray-600 dark:text-gray-400' },
  { key: 'submitted', label: 'Submitted', icon: ArrowRight, color: 'border-blue-300 dark:border-blue-700', headerColor: 'bg-blue-50 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
  { key: 'under_review', label: 'Under Review', icon: Clock, color: 'border-amber-300 dark:border-amber-700', headerColor: 'bg-amber-50 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'border-primary-300 dark:border-primary-700', headerColor: 'bg-primary-50 dark:bg-primary-900/20', textColor: 'text-primary-600 dark:text-primary-400' },
  { key: 'published', label: 'Published', icon: CheckCircle, color: 'border-green-300 dark:border-green-700', headerColor: 'bg-green-50 dark:bg-green-900/20', textColor: 'text-green-600 dark:text-green-400' },
];

export default function ApprovalWorkflow() {
  const { isLead } = useAuth();
  const [files, setFiles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [approveModal, setApproveModal] = useState(false);
  const [newStatus, setNewStatus] = useState('approved');
  const [comment, setComment] = useState('');

  const load = () => api.get('/files').then(r => setFiles(r.data.filter((f: any) => f.status !== 'archived')));
  useEffect(() => { load(); }, []);

  const getFilesForStage = (stage: string) => files.filter(f => f.status === stage);

  const doApprove = async () => {
    await api.post(`/files/${selected.id}/approve`, { status: newStatus, comments: comment });
    setApproveModal(false); setComment(''); load();
  };

  const quickMove = async (f: any, status: string) => {
    await api.post(`/files/${f.id}/approve`, { status, comments: '' });
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Approval Workflow</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage file review and publication pipeline</p>
      </div>

      {/* Pipeline stats */}
      <div className="flex gap-3 flex-wrap">
        {STAGES.map(s => {
          const count = getFilesForStage(s.key).length;
          return (
            <div key={s.key} className={`card px-4 py-3 flex items-center gap-2 ${count > 0 ? 'border-2 ' + s.color : ''}`}>
              <s.icon size={16} className={s.textColor} />
              <span className={`font-semibold text-sm ${s.textColor}`}>{count}</span>
              <span className="text-xs text-gray-500">{s.label}</span>
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
                <span className="ml-auto text-xs bg-white dark:bg-gray-900 rounded-full px-2 py-0.5 font-bold text-gray-700 dark:text-gray-300">{stageFiles.length}</span>
              </div>
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto bg-white dark:bg-gray-900">
                {stageFiles.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400">No files</div>
                ) : stageFiles.map(f => (
                  <div key={f.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl hover:shadow-sm cursor-pointer transition-all" onClick={() => setSelected(f)}>
                    <div className="flex items-center gap-2 mb-2">
                      <FileIcon mimeType={f.mime_type} name={f.original_name} size={16} />
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{f.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 space-y-0.5">
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
                            <button onClick={e => { e.stopPropagation(); quickMove(f, 'approved'); }} className="flex-1 text-xs py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-200 font-medium">Approve</button>
                            <button onClick={e => { e.stopPropagation(); quickMove(f, 'draft'); }} className="flex-1 text-xs py-1 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg hover:bg-red-100 font-medium">Reject</button>
                          </>
                        )}
                        {stage.key === 'approved' && (
                          <button onClick={e => { e.stopPropagation(); quickMove(f, 'published'); }} className="flex-1 text-xs py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 font-medium">Publish</button>
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
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <FileIcon mimeType={selected.mime_type} name={selected.original_name} size={28} />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selected.name}</h3>
                <p className="text-xs text-gray-500">{selected.project} · {selected.module} · v{selected.version}</p>
              </div>
            </div>
            {selected.description && <p className="text-sm text-gray-600 dark:text-gray-300">{selected.description}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[['Owner', selected.owner_name], ['Category', selected.category], ['Jira', selected.jira_ticket], ['Repository', selected.repository_name]].filter(([, v]) => v).map(([l, v]) => (
                <div key={l}><span className="text-gray-400">{l}: </span><span className="font-medium text-gray-900 dark:text-gray-100">{v}</span></div>
              ))}
            </div>
            {isLead && (
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => setApproveModal(true)} className="btn-primary w-full justify-center">Update Status</button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Update File Status" size="sm">
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
            <button onClick={() => setApproveModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={doApprove} className="btn-primary">Update</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
