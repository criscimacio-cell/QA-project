import { useState, useRef, useEffect } from 'react';
import { ChevronRight, Folder, FolderOpen, Plus, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import api from '../../api/client';
import { toast } from 'sonner';

export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  created_by: number;
}

interface FolderNode extends FolderItem {
  children: FolderNode[];
}

interface Props {
  folders: FolderItem[];
  activeFolderId: number | null | 'root';
  onSelect: (id: number | null | 'root') => void;
  onFoldersChange: () => void;
  canWrite: boolean;
  canDelete: boolean;
}

function buildTree(folders: FolderItem[]): FolderNode[] {
  const map: Record<number, FolderNode> = {};
  folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
  const roots: FolderNode[] = [];
  folders.forEach(f => {
    if (f.parent_id && map[f.parent_id]) map[f.parent_id].children.push(map[f.id]);
    else roots.push(map[f.id]);
  });
  return roots;
}

function FolderNode({ node, level, activeFolderId, onSelect, onFoldersChange, canWrite, canDelete }: {
  node: FolderNode; level: number;
  activeFolderId: number | null | 'root';
  onSelect: (id: number | null | 'root') => void;
  onFoldersChange: () => void;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = activeFolderId === node.id;

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  const handleRename = async () => {
    if (!newName.trim() || newName === node.name) { setRenaming(false); return; }
    try {
      await api.put(`/folders/${node.id}`, { name: newName.trim() });
      onFoldersChange();
      toast.success('Folder renamed');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to rename'); }
    setRenaming(false);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/folders/${node.id}`);
      onFoldersChange();
      toast.success('Folder deleted');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        onClick={() => { onSelect(node.id); if (node.children.length) setOpen(o => !o); }}
      >
        {node.children.length > 0
          ? <ChevronRight size={12} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          : <span className="w-3 shrink-0" />}
        {open ? <FolderOpen size={14} className="shrink-0 text-amber-500" /> : <Folder size={14} className="shrink-0 text-amber-400" />}
        {renaming
          ? <input ref={inputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onBlur={handleRename} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              onClick={e => e.stopPropagation()}
              className="flex-1 bg-transparent border-b border-amber-400 outline-none text-sm" />
          : <span className="flex-1 truncate">{node.name}</span>}
        {(canWrite || canDelete) && !renaming && (
          <div ref={menuRef} className="relative opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(m => !m)} className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700">
              <MoreHorizontal size={12} />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[120px]">
                {canWrite && <button role="menuitem" onClick={() => { setRenaming(true); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"><Pencil size={11}/> Rename</button>}
                {canDelete && <button role="menuitem" onClick={() => { handleDelete(); setMenuOpen(false); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600"><Trash2 size={11}/> Delete</button>}
              </div>
            )}
          </div>
        )}
      </div>
      {open && node.children.map(child => (
        <FolderNode key={child.id} node={child} level={level + 1} activeFolderId={activeFolderId}
          onSelect={onSelect} onFoldersChange={onFoldersChange} canWrite={canWrite} canDelete={canDelete} />
      ))}
    </div>
  );
}

export default function FolderTree({ folders, activeFolderId, onSelect, onFoldersChange, canWrite, canDelete }: Props) {
  const [creatingName, setCreatingName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showInput) inputRef.current?.focus(); }, [showInput]);

  const handleCreate = async () => {
    if (!creatingName.trim()) { setShowInput(false); return; }
    setCreating(true);
    try {
      await api.post('/folders', { name: creatingName.trim(), parent_id: typeof activeFolderId === 'number' ? activeFolderId : null });
      onFoldersChange();
      toast.success('Folder created');
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed to create folder'); }
    setCreating(false);
    setCreatingName('');
    setShowInput(false);
  };

  const tree = buildTree(folders);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Folders</span>
        {canWrite && (
          <button onClick={() => setShowInput(s => !s)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-500 transition-colors" title="New folder">
            <Plus size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {/* All Files */}
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${activeFolderId === null ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
          onClick={() => onSelect(null)}
        >
          <Folder size={14} className="shrink-0 text-slate-400" />
          <span>All Files</span>
        </div>

        {/* Root (unfiled) */}
        <div
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition-colors ${activeFolderId === 'root' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
          onClick={() => onSelect('root')}
        >
          <Folder size={14} className="shrink-0 text-slate-400" />
          <span>Unfiled</span>
        </div>

        {tree.map(node => (
          <FolderNode key={node.id} node={node} level={0} activeFolderId={activeFolderId}
            onSelect={onSelect} onFoldersChange={onFoldersChange} canWrite={canWrite} canDelete={canDelete} />
        ))}

        {showInput && (
          <div className="flex items-center gap-1 px-2 py-1.5">
            <Folder size={14} className="shrink-0 text-amber-400" />
            <input ref={inputRef} value={creatingName} onChange={e => setCreatingName(e.target.value)}
              onBlur={handleCreate}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowInput(false); setCreatingName(''); } }}
              placeholder="Folder name…" disabled={creating}
              className="flex-1 bg-transparent border-b border-amber-400 outline-none text-sm text-slate-700 dark:text-slate-300" />
          </div>
        )}
      </div>
    </div>
  );
}
