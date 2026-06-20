import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Palette, Database, Key, Tag, Plus, Trash2, Camera, X, Check, Sun, Moon, Monitor, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../api/client';
import ConfirmModal from '../components/UI/ConfirmModal';

export default function Settings() {
  const { user, isAdmin, refreshUser } = useAuth();
  const { dark, mode: themeMode, setMode: setThemeMode } = useTheme();
  const [activeSection, setActiveSection] = useState('Appearance');

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState({
    email_on_submit: true,
    email_on_approve: true,
    email_on_reject: true,
    inapp_on_submit: true,
    inapp_on_approve: true,
    inapp_on_mention: true,
  });
  const [notifSaved, setNotifSaved] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    if (activeSection !== 'Notifications') return;
    setNotifLoading(true);
    api.get('/users/me').then(r => {
      const prefs = r.data?.preferences?.notifications;
      if (prefs) setNotifPrefs(p => ({ ...p, ...prefs }));
    }).catch(() => {}).finally(() => setNotifLoading(false));
  }, [activeSection]);

  const saveNotifPrefs = async () => {
    setSavingNotif(true);
    try {
      await api.patch('/users/me/preferences', { preferences: { notifications: notifPrefs } });
      setNotifSaved(true);
      toast.success('Notification preferences saved');
      setTimeout(() => setNotifSaved(false), 2000);
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSavingNotif(false);
    }
  };

  // Appearance state
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'normal');
  const [sidebarCompact, setSidebarCompact] = useState(() => localStorage.getItem('sidebarCompact') === 'true');
  const [appearanceSaved, setAppearanceSaved] = useState(false);

  const saveAppearance = () => {
    localStorage.setItem('fontSize', fontSize);
    localStorage.setItem('sidebarCompact', String(sidebarCompact));
    // Apply font size
    const sizes: Record<string, string> = { small: '13px', normal: '14px', large: '15px', xlarge: '16px' };
    document.documentElement.style.setProperty('--base-font-size', sizes[fontSize] || '14px');
    setAppearanceSaved(true);
    toast.success('Appearance settings saved');
    setTimeout(() => setAppearanceSaved(false), 2000);
  };

  useEffect(() => {
    const sizes: Record<string, string> = { small: '13px', normal: '14px', large: '15px', xlarge: '16px' };
    document.documentElement.style.setProperty('--base-font-size', sizes[fontSize] || '14px');
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

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
      toast.success('Profile photo updated');
      setTimeout(() => setAvatarMsg(''), 3000);
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Upload failed';
      setAvatarMsg(msg);
      toast.error(msg);
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

  function passwordStrength(pw: string): { label: string; color: string } {
    if (!pw) return { label: '', color: '' };
    const checks = [pw.length >= 8, /[A-Z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)];
    const score = checks.filter(Boolean).length;
    if (score <= 1) return { label: 'Weak', color: 'text-red-500' };
    if (score <= 2) return { label: 'Fair', color: 'text-amber-500' };
    if (score <= 3) return { label: 'Good', color: 'text-blue-500' };
    return { label: 'Strong', color: 'text-emerald-500' };
  }

  const validatePassword = () => {
    const e: Record<string, string> = {};
    if (!currentPw) e.currentPassword = 'Current password is required';
    if (!newPw) e.newPassword = 'New password is required';
    else if (newPw.length < 8) e.newPassword = 'Password must be at least 8 characters';
    else if (!/[0-9]/.test(newPw) && !/[^A-Za-z0-9]/.test(newPw)) e.newPassword = 'Password must contain at least one number or special character';
    else if (newPw === currentPw) e.newPassword = 'New password cannot be the same as your current password';
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
      toast.success('Password changed successfully');
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Failed to change password';
      setPwErr(msg);
      toast.error(msg);
    }
  };

  // Categories state
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'file' | 'knowledge' | 'user_type'>('file');
  const [catSaving, setCatSaving] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: number; name: string } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  const loadCategories = () => {
    setCatLoading(true);
    api.get('/categories').then(r => { setAllCategories(r.data); setCatLoading(false); }).catch(() => setCatLoading(false));
  };

  useEffect(() => { if (activeSection === 'Categories') loadCategories(); }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'Security') {
      setPwMsg('');
    }
  }, [activeSection]);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    setCatSaving(true);
    try {
      await api.post('/categories', { name: newCatName.trim(), type: newCatType });
      toast.success('Category added');
      setNewCatName('');
      loadCategories();
    } catch {
      toast.error('Failed to add category');
    } finally { setCatSaving(false); }
  };

  const deleteCategory = async (id: number) => {
    setDeletingCategory(true);
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      setCategoryToDelete(null);
      loadCategories();
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setDeletingCategory(false);
    }
  };

  const sections = [
    { icon: Palette, label: 'Appearance' },
    { icon: Bell, label: 'Notifications' },
    { icon: Shield, label: 'Security' },
    { icon: Database, label: 'Storage' },
    { icon: Tag, label: 'Categories' },
    { icon: Key, label: 'API Access' },
    ...(isAdmin ? [{ icon: Building2, label: 'Organization', href: '/org-settings' }] : []),
  ] as { icon: any; label: string; href?: string }[];

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
            {sections.map(s => s.href ? (
              <a key={s.label} href={s.href} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <s.icon size={16} />{s.label}
              </a>
            ) : (
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
                    style={{ background: 'linear-gradient(135deg,#F59E0B,#FBBF24)', border: '2px solid white' }}
                    title="Change profile photo"
                    aria-label="Change profile photo"
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
                      {avatarSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
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
                <Key size={18} className="text-[#F59E0B]" /> Change Password
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
                  {newPw && (() => { const s = passwordStrength(newPw); return <p className={`text-xs mt-1 font-medium ${s.color}`}>Strength: {s.label}</p>; })()}
                  <p className="text-xs text-slate-400 mt-0.5">Min 8 characters, at least one number or special character</p>
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

          {/* Platform Info — shown under Storage section, admin only */}
          {activeSection === 'Storage' && isAdmin && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <SettingsIcon size={18} className="text-[#F59E0B]" /> Platform Information
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Platform', 'Qlarity v1.0.0'],
                  ['Environment', 'Production'],
                  ['Database', 'PostgreSQL'],
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
                <Tag size={18} className="text-[#F59E0B]" /> Category Manager
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
                    <select value={newCatType} onChange={e => setNewCatType(e.target.value as 'file' | 'knowledge' | 'user_type')} className="input">
                      <option value="file">File</option>
                      <option value="knowledge">Knowledge</option>
                      <option value="user_type">User Type</option>
                    </select>
                  </div>
                  <button onClick={addCategory} disabled={!newCatName.trim() || catSaving} className="btn-primary h-9">
                    {catSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              )}

              {catLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#F59E0B]" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {(['file', 'knowledge', 'user_type'] as const).map(type => {
                    const cats = allCategories.filter(c => c.type === type);
                    const label = type === 'file' ? 'File Categories' : type === 'knowledge' ? 'Knowledge Categories' : 'User Types';
                    return (
                      <div key={type}>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                          {label}
                        </h3>
                        <div className="space-y-1.5">
                          {cats.length === 0 && <p className="text-xs text-slate-400 italic">No categories yet</p>}
                          {cats.map(cat => (
                            <div key={cat.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg group">
                              <span className="text-sm text-slate-700 dark:text-slate-300">{cat.name}</span>
                              {isAdmin && (
                                <button
                                  onClick={() => setCategoryToDelete({ id: cat.id, name: cat.name })}
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

          {/* Appearance */}
          {activeSection === 'Appearance' && (
            <div className="space-y-5">
              {/* Theme */}
              <div className="card p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Palette size={18} className="text-[#F59E0B]" /> Theme
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-slate-200', text: 'text-slate-800', bar: 'bg-slate-100', accent: 'bg-amber-400' },
                    { id: 'dark',  label: 'Dark',  icon: Moon, preview: 'bg-slate-900 border-slate-700', text: 'text-slate-100', bar: 'bg-slate-800', accent: 'bg-amber-400' },
                    { id: 'system', label: 'System', icon: Monitor, preview: 'bg-gradient-to-br from-white to-slate-900 border-slate-300', text: 'text-slate-500', bar: 'bg-gradient-to-r from-slate-100 to-slate-800', accent: 'bg-amber-400' },
                  ].map(t => {
                    const isActive = t.id === themeMode;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setThemeMode(t.id as 'light' | 'dark' | 'system')}
                        className={`relative rounded-xl border-2 p-3 transition-all text-left ${isActive ? 'border-[#F59E0B] shadow-md shadow-amber-100 dark:shadow-amber-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-[#F59E0B]/50'}`}
                      >
                        {isActive && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center">
                            <Check size={11} color="white" />
                          </div>
                        )}
                        {/* Mini preview */}
                        <div className={`w-full h-16 rounded-lg border mb-2.5 overflow-hidden ${t.preview}`}>
                          <div className={`h-3 w-full ${t.bar} flex items-center px-1.5 gap-1`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${t.accent}`} />
                            <div className={`h-0.5 w-8 rounded ${t.bar === 'bg-slate-100' ? 'bg-slate-300' : 'bg-slate-600'}`} />
                          </div>
                          <div className="p-1.5 space-y-1">
                            <div className={`h-1.5 w-3/4 rounded ${t.bar === 'bg-slate-100' ? 'bg-slate-200' : 'bg-slate-700'}`} />
                            <div className={`h-1.5 w-1/2 rounded ${t.bar === 'bg-slate-100' ? 'bg-slate-200' : 'bg-slate-700'}`} />
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <t.icon size={13} className="text-slate-500 dark:text-slate-400" />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size */}
              <div className="card p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Font Size</h2>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'small', label: 'Small', sample: 'text-[11px]' },
                    { id: 'normal', label: 'Normal', sample: 'text-[13px]' },
                    { id: 'large', label: 'Large', sample: 'text-[15px]' },
                    { id: 'xlarge', label: 'X-Large', sample: 'text-[17px]' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFontSize(f.id)}
                      className={`rounded-xl border-2 p-3 transition-all text-center ${fontSize === f.id ? 'border-[#F59E0B] bg-[#F59E0B]/5' : 'border-slate-200 dark:border-slate-700 hover:border-[#F59E0B]/40'}`}
                    >
                      <span className={`${f.sample} font-medium text-slate-700 dark:text-slate-300 block mb-1`}>Aa</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{f.label}</span>
                      {fontSize === f.id && <div className="mt-1.5 mx-auto w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Options */}
              <div className="card p-6 space-y-4">
                <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Layout</h2>
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">Compact Sidebar</div>
                    <div className="text-xs text-slate-400 mt-0.5">Show icons only, hide labels</div>
                  </div>
                  <button
                    onClick={() => setSidebarCompact(v => !v)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${sidebarCompact ? 'bg-[#F59E0B]' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sidebarCompact ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={saveAppearance} className="btn-primary">
                  <Check size={15} /> Save Appearance
                </button>
                {appearanceSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved!</span>}
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeSection === 'Notifications' && (
            <div className="card p-6 space-y-5">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Bell size={18} className="text-[#F59E0B]" /> Notification Preferences
              </h2>
              {notifLoading ? (
                <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-[#F59E0B]" /></div>
              ) : (
                <div className="space-y-4">
                  {[
                    { section: 'Email Notifications', items: [
                      { key: 'email_on_submit', label: 'File submitted for review', desc: 'Get emailed when a file is submitted for your review' },
                      { key: 'email_on_approve', label: 'File approved or published', desc: 'Get emailed when your file is approved or published' },
                      { key: 'email_on_reject', label: 'File returned or rejected', desc: 'Get emailed when your file is returned to draft' },
                    ]},
                    { section: 'In-App Notifications', items: [
                      { key: 'inapp_on_submit', label: 'File submitted for review', desc: 'See a notification when a file needs your review' },
                      { key: 'inapp_on_approve', label: 'File status updated', desc: 'See a notification when your file status changes' },
                      { key: 'inapp_on_mention', label: '@Mentions in comments', desc: 'See a notification when someone mentions you' },
                    ]},
                  ].map(group => (
                    <div key={group.section}>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{group.section}</h3>
                      <div className="space-y-2">
                        {group.items.map(item => (
                          <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                            <div>
                              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.label}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
                            </div>
                            <button
                              onClick={() => setNotifPrefs(p => ({ ...p, [item.key]: !p[item.key as keyof typeof p] }))}
                              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${notifPrefs[item.key as keyof typeof notifPrefs] ? 'bg-[#F59E0B]' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${notifPrefs[item.key as keyof typeof notifPrefs] ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 pt-2">
                    <button onClick={saveNotifPrefs} disabled={savingNotif} className="btn-primary flex items-center gap-1.5">
                      {savingNotif ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {savingNotif ? 'Saving...' : 'Save Preferences'}
                    </button>
                    {notifSaved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">✓ Saved!</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* API Access — placeholder */}
          {activeSection === 'API Access' && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
                <Key size={18} className="text-[#F59E0B]" /> API Access
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">API key management coming soon.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!categoryToDelete}
        onClose={() => { if (!deletingCategory) setCategoryToDelete(null); }}
        onConfirm={async () => {
          if (!categoryToDelete || deletingCategory) return;
          await deleteCategory(categoryToDelete.id);
        }}
        title="Delete Category"
        message={`"${categoryToDelete?.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete"
        loading={deletingCategory}
      />
    </div>
  );
}
