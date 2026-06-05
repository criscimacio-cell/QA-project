import { useState } from 'react';
import { Settings as SettingsIcon, Shield, Bell, Palette, Database, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Settings() {
  const { user } = useAuth();
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

  const sections = [
    { icon: Palette, label: 'Appearance', active: false },
    { icon: Bell, label: 'Notifications', active: false },
    { icon: Shield, label: 'Security', active: true },
    { icon: Database, label: 'Storage', active: false },
    { icon: Key, label: 'API Access', active: false },
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
              <button key={s.label} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${s.active ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <s.icon size={16} />{s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5">
          {/* Profile */}
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

          {/* Change Password */}
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

          {/* Platform Info */}
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
        </div>
      </div>
    </div>
  );
}
