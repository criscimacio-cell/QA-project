import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Palette, Database, Key, Tag, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState('Security');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwErr("Passwords don't match"); return; }
    if (newPw.length < 8) { setPwErr("Password must be at least 8 characters"); return; }
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password changed successfully'); setPwErr('');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (e: any) { setPwErr(e.response?.data?.error || 'Failed to change password'); }
  };

  // Categories state
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'file' | 'knowledge'>('file');
  const [catSaving, setCatSaving] = useState(false);

  const loadCategories = () => {
    setCatLoading(true);
    api.get('/categories').then(r => { setAllCategories(r.data); setCatLoading(false); }).catch(() => setCatLoading(false));
  };

  useEffect(() => { if (activeSection === 'Categories') loadCategories(); }, [activeSection]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      await api.post('/categories', { name: newCatName.trim(), type: newCatType });
      setNewCatName('');
      loadCategories();
    } finally { setCatSaving(false); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm('Delete this category?')) return;
    await api.delete(`/categories/${id}`);
    loadCategories();
  };

  const sections = [
    { icon: Palette, label: 'Appearance' },
    { icon: Bell, label: 'Notifications' },
    { icon: Shield, label: 'Security' },
    { icon: Database, label: 'Storage' },
    { icon: Tag, label: 'Categories' },
    { icon: Key, label: 'API Access' },
  ];

  return (
    <div className="space-y-5 max-w-4xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage your account and platform preferences</p>
      </div>

      <div className="flex gap-6">
        {/* Nav */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map(s => (
              <button key={s.label} onClick={() => setActiveSection(s.label)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeSection === s.label ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <s.icon size={16} />{s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5">
          {/* Profile — always visible */}
          <div className="card p-6">
            <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Profile Information</h2>
            <div className="flex items-center gap-4 mb-4">
              <img src={user?.avatar} alt="" className="w-16 h-16 rounded-full bg-slate-100" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{user?.name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
                <div className="text-xs text-teal-600 dark:text-teal-400 capitalize mt-0.5 font-medium">{user?.role} · {user?.department}</div>
              </div>
            </div>
          </div>

          {/* Security section */}
          {activeSection === 'Security' && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Key size={18} className="text-[#08a49c]" /> Change Password
              </h2>
              {pwMsg && <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-400">{pwMsg}</div>}
              {pwErr && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">{pwErr}</div>}
              <form onSubmit={changePassword} className="space-y-4 max-w-sm">
                <div><label className="label">Current Password</label><input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} className="input" required /></div>
                <div><label className="label">New Password</label><input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} className="input" required /></div>
                <div><label className="label">Confirm New Password</label><input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className="input" required /></div>
                <button type="submit" className="btn-primary">Update Password</button>
              </form>
            </div>
          )}

          {/* Platform Info — shown under Storage section */}
          {activeSection === 'Storage' && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <SettingsIcon size={18} className="text-[#08a49c]" /> Platform Information
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Platform', 'Q-KTAMP v1.0.0'],
                  ['Environment', 'Production'],
                  ['Database', 'SQLite (WAL Mode)'],
                  ['Authentication', 'JWT (8h sessions)'],
                  ['File Storage', 'Local / Network Drive'],
                  ['Last Updated', new Date().toLocaleDateString()],
                ].map(([l, v]) => (
                  <div key={l} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="text-xs text-slate-500 dark:text-slate-400">{l}</div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories section */}
          {activeSection === 'Categories' && (
            <div className="card p-6 space-y-5">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Tag size={18} className="text-[#08a49c]" /> Category Manager
              </h2>

              {/* Add category */}
              {isAdmin && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="label">New Category Name</label>
                    <input
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCategory()}
                      className="input"
                      placeholder="e.g. Performance"
                    />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <select value={newCatType} onChange={e => setNewCatType(e.target.value as 'file' | 'knowledge')} className="input">
                      <option value="file">File</option>
                      <option value="knowledge">Knowledge</option>
                    </select>
                  </div>
                  <button onClick={addCategory} disabled={!newCatName.trim() || catSaving} className="btn-primary h-9">
                    {catSaving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              )}

              {catLoading ? (
                <div className="flex justify-center py-8"><RefreshCw size={20} className="animate-spin text-[#08a49c]" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(['file', 'knowledge'] as const).map(type => {
                    const cats = allCategories.filter(c => c.type === type);
                    return (
                      <div key={type}>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {type === 'file' ? 'File Categories' : 'Knowledge Categories'}
                        </h3>
                        <div className="space-y-1.5">
                          {cats.length === 0 && <p className="text-xs text-slate-400 italic">No categories yet</p>}
                          {cats.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg group">
                              <span className="text-sm text-slate-700 dark:text-slate-300">{cat.name}</span>
                              {isAdmin && (
                                <button
                                  onClick={() => deleteCategory(cat.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-0.5 rounded"
                                  title="Delete category"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Appearance, Notifications, API Access — placeholder panels */}
          {(activeSection === 'Appearance' || activeSection === 'Notifications' || activeSection === 'API Access') && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                {activeSection}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeSection} settings are not yet configurable in this version.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
