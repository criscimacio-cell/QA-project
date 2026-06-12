import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Palette, Database, Key, Tag, Plus, Trash2, RefreshCw, Camera, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Settings() {
  const { user, isAdmin, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState('Security');

  // Avatar state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarMsg('');
  };

  const saveAvatar = async () => {
    if (!avatarFile) return;
    setAvatarSaving(true);
    try {
      const fd = new FormData();
      fd.append('avatar', avatarFile);
      await api.put('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      setAvatarPreview(null);
      setAvatarFile(null);
      setAvatarMsg('Profile photo updated!');
      setTimeout(() => setAvatarMsg(''), 3000);
    } catch (e: any) {
      setAvatarMsg(e.response?.data?.error || 'Upload failed');
    } finally {
      setAvatarSaving(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const cancelAvatar = () => {
    setAvatarPreview(null);
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validatePassword = () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPassword = 'Current password is required';
    if (!newPw) e.newPassword = 'New password is required';
    else if (newPw.length < 8) e.newPassword = 'Password must be at least 8 characters';
    if (!confirmPw) e.confirmPassword = 'Please confirm your new password';
    else if (newPw && confirmPw !== newPw) e.confirmPassword = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;
    try {
      await api.post('/auth/change-password', { currentPassword: currentPw, newPassword: newPw });
      setPwMsg('Password changed successfully'); setPwErr(''); setErrors({});
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
    try {
      await api.delete(`/categories/${id}`);
    } catch {
      alert('Failed to delete category.');
    }
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
            <div className="flex items-center gap-5">
              {/* Avatar with edit overlay */}
              <div className="relative flex-shrink-0">
                <img
                  src={avatarPreview || user?.avatar}
                  alt={user?.name}
                  className="w-20 h-20 rounded-full object-cover bg-slate-100 border-2 border-slate-200 dark:border-slate-700"
                />
                {/* Camera button */}
                {!avatarPreview && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-all hover:scale-110"
                    style={{ background: 'linear-gradient(135deg,#08a49c,#06b6d4)', border: '2px solid white' }}
                    title="Change profile photo"
                  >
                    <Camera size={12} color="white" />
                  </button>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-slate-100">{user?.name}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</div>
                <div className="text-xs text-teal-600 dark:text-teal-400 capitalize mt-0.5 font-medium">{user?.role} · {user?.department}</div>

                {/* Preview action buttons */}
                {avatarPreview && (
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={saveAvatar}
                      disabled={avatarSaving}
                      className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                    >
                      {avatarSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                      {avatarSaving ? 'Saving...' : 'Save photo'}
                    </button>
                    <button onClick={cancelAvatar} className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                )}

                {/* Status message */}
                {avatarMsg && !avatarPreview && (
                  <p className={`text-xs mt-2 font-medium ${/fail|error|only|large|invalid/i.test(avatarMsg) ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {avatarMsg}
                  </p>
                )}

                {!avatarPreview && (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs text-teal-600 dark:text-teal-400 hover:underline mt-2 block"
                  >
                    Change profile photo
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">JPG, PNG, GIF or WEBP · Max 2MB</p>
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
                <div>
                  <label className="label">Current Password<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="password" value={currentPw} onChange={e => { setCurrentPw(e.target.value); if (errors.currentPassword) setErrors(p => ({ ...p, currentPassword: '' })); }} className={`input ${errors.currentPassword ? 'border-red-400 focus:ring-red-300' : ''}`} />
                  {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword}</p>}
                </div>
                <div>
                  <label className="label">New Password<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="password" value={newPw} onChange={e => {
                    const v = e.target.value;
                    setNewPw(v);
                    setErrors(p => {
                      const n: Record<string, string> = { ...p, newPassword: '' };
                      if (confirmPw) n.confirmPassword = confirmPw !== v ? "Passwords don't match" : '';
                      return n;
                    });
                  }} className={`input ${errors.newPassword ? 'border-red-400 focus:ring-red-300' : ''}`} />
                  {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>}
                </div>
                <div>
                  <label className="label">Confirm New Password<span className="text-red-500 ml-0.5">*</span></label>
                  <input type="password" value={confirmPw} onChange={e => {
                    const v = e.target.value;
                    setConfirmPw(v);
                    setErrors(p => ({ ...p, confirmPassword: v && newPw && v !== newPw ? "Passwords don't match" : '' }));
                  }} className={`input ${errors.confirmPassword ? 'border-red-400 focus:ring-red-300' : ''}`} />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
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
