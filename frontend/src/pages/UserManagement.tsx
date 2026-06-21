import { useState, useEffect } from 'react';
import { Plus, Edit2, UserCheck, UserX, Loader2, Eye, EyeOff, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import Pagination from '../components/UI/Pagination';
import Modal from '../components/UI/Modal';
import ConfirmModal from '../components/UI/ConfirmModal';
import { useAuth } from '../context/AuthContext';

function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const arr = new Uint8Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

const ROLES = ['admin', 'lead', 'engineer', 'viewer'];

const PLAN_USER_LIMITS: Record<string, number> = { free: 5, pro: 25, enterprise: Infinity };

export default function UserManagement() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'engineer', department: '', active: 1 });
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  // Success modal state
  const [successUser, setSuccessUser] = useState<{ name: string; email: string; role: string; password: string } | null>(null);
  const [successPwCopied, setSuccessPwCopied] = useState(false);
  const [successPwVisible, setSuccessPwVisible] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/users', { params: { limit, offset } });
      const data = r.data;
      if (Array.isArray(data)) { setUsers(data); setTotal(data.length); }
      else { setUsers(data.users ?? []); setTotal(data.total ?? 0); }
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [offset]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    else if (form.name.trim().length > 100) e.name = 'Name must be 100 characters or fewer';
    if (!editing) {
      if (!form.email.trim()) e.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
      else if (form.email.trim().length > 150) e.email = 'Email must be 150 characters or fewer';
      if (!password) e.password = 'Password is required';
      else if (password.length < 8) e.password = 'Password must be at least 8 characters';
    } else if (password && password.length < 8) {
      e.password = 'Password must be at least 8 characters';
    }
    if (!form.role) e.role = 'Role is required';
    if (form.department.trim().length > 100) e.department = 'Department must be 100 characters or fewer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const closeModal = () => {
    setShowModal(false); setEditing(null); setErrors({});
    setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 });
    setPassword(''); setShowPw(false); setCopied(false);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copySuccessPassword = () => {
    if (!successUser) return;
    navigator.clipboard.writeText(successUser.password).then(() => {
      setSuccessPwCopied(true);
      setTimeout(() => setSuccessPwCopied(false), 2000);
    });
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { ...form, ...(password ? { password } : {}) });
        toast.success('User updated successfully');
        closeModal();
      } else {
        await api.post('/users', { ...form, password });
        closeModal();
        setSuccessUser({ name: form.name, email: form.email, role: form.role, password });
        setSuccessPwCopied(false);
        setSuccessPwVisible(false);
      }
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (u: any) => {
    setEditing(u); setErrors({});
    setForm({ name: u.name || '', email: u.email || '', role: u.role || 'engineer', department: u.department || '', active: u.active });
    setPassword(''); setShowPw(false); setCopied(false);
    setShowModal(true);
  };

  const toggleActive = (u: any) => {
    if (u.id === user?.id) { toast.error('You cannot deactivate your own account.'); return; }
    setConfirmToggle(u);
  };

  const confirmToggleActive = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      if (confirmToggle.active) {
        await api.put(`/users/${confirmToggle.id}/deactivate`);
      } else {
        await api.put(`/users/${confirmToggle.id}/activate`);
      }
      toast.success(confirmToggle.active ? 'User deactivated' : 'User activated');
      load();
    } catch {
      toast.error('Failed to update user status');
    } finally {
      setToggling(false);
      setConfirmToggle(null);
    }
  };

  const roleCount = (role: string) => users.filter(u => u.role === role).length;

  const roleLabel = (r: string) => r === 'admin' ? 'Admin' : r === 'lead' ? 'Lead' : r === 'engineer' ? 'Engineer' : 'Viewer';

  const orgPlan = (user as any)?.org_plan ?? 'free';
  const userLimit = PLAN_USER_LIMITS[orgPlan] ?? 5;
  const activeUsers = users.filter(u => u.active).length;
  const atLimit = isFinite(userLimit) && activeUsers >= userLimit;
  const nearLimit = isFinite(userLimit) && activeUsers >= userLimit * 0.8;

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Manage team members and access control</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setEditing(null); setErrors({}); setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 }); setShowModal(true); }} className="btn-primary" onMouseDown={e => e.currentTarget.style.animation = 'springBounce 0.38s cubic-bezier(0.34,1.5,0.64,1) both'} onAnimationEnd={e => e.currentTarget.style.animation = ''}>
            <Plus size={16} /> Add User
          </button>
        )}
      </div>

      {/* Plan user limit banner */}
      {isAdmin && isFinite(userLimit) && (
        <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
          atLimit   ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
          nearLimit ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' :
                      'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className={atLimit ? 'text-red-700 dark:text-red-300' : nearLimit ? 'text-amber-700 dark:text-amber-300' : 'text-slate-600 dark:text-slate-400'}>
              {activeUsers} of {userLimit} users used
              {atLimit ? ' — limit reached' : nearLimit ? ' — approaching limit' : ''}
            </span>
            <span className="text-xs text-slate-400 capitalize">({orgPlan} plan)</span>
          </div>
          {(atLimit || nearLimit) && (
            <a href="/org-settings" className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline">View plan →</a>
          )}
        </div>
      )}

      {/* Role summary */}
      <div className="grid grid-cols-4 gap-4">
        {ROLES.map(r => (
          <div key={r} className="card p-4 text-center">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{roleCount(r)}</div>
            <span className={`badge-${r} mt-1 inline-flex`}>{roleLabel(r)}</span>
          </div>
        ))}
      </div>

      {/* Permission Matrix */}
      <div className="card p-5">
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Permission Matrix</h3>
        {loading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shimmer-bg rounded-lg h-10" />
            ))}
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Permission</th>
                {['Admin', 'Lead', 'Engineer', 'Viewer'].map(r => <th key={r} className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[
                ['Upload Files', true, true, true, false],
                ['Download Files', true, true, true, true],
                ['Edit Own Files', true, true, true, false],
                ['Delete Files', true, true, false, false],
                ['Approve / Publish', true, true, false, false],
                ['Manage Repositories', true, true, false, false],
                ['View Analytics', true, true, false, false],
                ['User Management', true, false, false, false],
                ['Audit Logs', true, true, false, false],
                ['System Settings', true, false, false, false],
              ].map(([label, ...perms]) => (
                <tr key={label as string} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 text-sm font-medium">{label as string}</td>
                  {(perms as boolean[]).map((p, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {p ? <span className="text-emerald-500 text-lg">✓</span> : <span className="text-slate-300 dark:text-slate-600 text-lg">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* User Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                {['User', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((u, index) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50" style={{ animation: 'rowStagger 0.28s ease both', animationDelay: `${index * 0.03}s`, transition: 'background 0.15s ease' }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email)}`; }} />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-${u.role}`}>{roleLabel(u.role)}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    {u.active ? <span className="badge-approved">Active</span> : <span className="badge-archived">Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isAdmin && <button onClick={() => startEdit(u)} title="Edit" className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><Edit2 size={14} /></button>}
                      {isAdmin && <button onClick={() => toggleActive(u)} title={u.active ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${u.active ? 'text-red-400' : 'text-emerald-500'}`}>
                        {u.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {users.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">No users found</div>
      )}
      <div className="px-4 pb-4">
        <Pagination total={total} limit={limit} offset={offset} onPageChange={setOffset} />
      </div>

      {/* Confirm deactivate/activate modal */}
      <ConfirmModal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={confirmToggleActive}
        title={confirmToggle?.active ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${confirmToggle?.active ? 'deactivate' : 'activate'} ${confirmToggle?.name}?`}
        confirmLabel={confirmToggle?.active ? 'Deactivate' : 'Activate'}
        loading={toggling}
      />

      {/* Add / Edit User modal */}
      <Modal open={showModal} onClose={closeModal} title={editing ? 'Edit User' : 'Add New User'} size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Full Name<span className="text-red-500 ml-0.5">*</span></label>
            <input value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); if (errors.name) setErrors(p => ({ ...p, name: '' })); }} className={`input ${errors.name ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="John Doe" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          {!editing && (
            <div>
              <label className="label">Email<span className="text-red-500 ml-0.5">*</span></label>
              <input type="email" value={form.email} onChange={e => { setForm(p => ({ ...p, email: e.target.value })); if (errors.email) setErrors(p => ({ ...p, email: '' })); }} className={`input ${errors.email ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="john@company.com" />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
          )}
          {editing && (
            <div>
              <label className="label">Email</label>
              <input className="input bg-slate-50 dark:bg-slate-800" value={form.email} disabled readOnly />
            </div>
          )}
          <div>
            <label className="label">Role<span className="text-red-500 ml-0.5">*</span></label>
            <select value={form.role} onChange={e => { setForm(p => ({ ...p, role: e.target.value })); if (errors.role) setErrors(p => ({ ...p, role: '' })); }} className={`input ${errors.role ? 'border-red-400 focus:ring-red-300' : ''}`}>
              <option value="admin">Admin</option>
              <option value="lead">Lead</option>
              <option value="engineer">Engineer</option>
              <option value="viewer">Viewer</option>
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>
          <div>
            <label className="label">Department</label>
            <input value={form.department} onChange={e => { setForm(p => ({ ...p, department: e.target.value })); if (errors.department) setErrors(p => ({ ...p, department: '' })); }} className={`input ${errors.department ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="e.g. Engineering, Sales, Operations" />
            {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
          </div>
          <div>
            <label className="label">
              {editing ? 'New Password' : 'Password'}
              {!editing && <span className="text-red-500 ml-0.5">*</span>}
              {editing && <span className="text-xs font-normal text-slate-400 ml-1">(leave blank to keep current)</span>}
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: '' })); }}
                className={`input pr-24 ${errors.password ? 'border-red-400 focus:ring-red-300' : ''}`}
                placeholder={editing ? 'Enter new password to change…' : 'Min. 8 characters'}
                autoComplete="new-password"
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <button type="button" tabIndex={-1} onClick={copyPassword} disabled={!password}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 disabled:opacity-30"
                  title="Copy password">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
                <button type="button" tabIndex={-1}
                  onClick={() => { const p = generatePassword(); setPassword(p); if (errors.password) setErrors(prev => ({ ...prev, password: '' })); }}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                  title="Generate strong password">
                  <RefreshCw size={13} />
                </button>
                <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? (saving ? 'Saving...' : 'Save Changes') : (saving ? 'Creating...' : 'Create User')}
            </button>
          </div>
        </div>
      </Modal>

      {/* User created success modal */}
      <Modal open={!!successUser} onClose={() => setSuccessUser(null)} title="User Created Successfully" size="sm">
        {successUser && (
          <div className="space-y-4">
            {/* Success icon */}
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <ShieldCheck size={28} className="text-emerald-500" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                Share the credentials below with the new user. The password will not be shown again.
              </p>
            </div>

            {/* Credentials card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Name</span>
                <span className="text-slate-800 dark:text-slate-100 font-semibold">{successUser.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Email</span>
                <span className="text-slate-800 dark:text-slate-100 font-mono text-xs">{successUser.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Role</span>
                <span className={`badge-${successUser.role}`}>{roleLabel(successUser.role)}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Password</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setSuccessPwVisible(v => !v)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      aria-label={successPwVisible ? 'Hide password' : 'Show password'}>
                      {successPwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                    <button type="button" onClick={copySuccessPassword}
                      className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs font-medium">
                      {successPwCopied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      {successPwCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="font-mono text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 tracking-wider">
                  {successPwVisible ? successUser.password : '••••••••••••••'}
                </div>
              </div>
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Make sure to copy the password now — it cannot be retrieved later.
            </p>

            <div className="flex justify-end pt-1">
              <button onClick={() => setSuccessUser(null)} className="btn-primary">Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
