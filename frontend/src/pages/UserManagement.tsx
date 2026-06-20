import { useState, useEffect } from 'react';
import { Plus, Edit2, UserCheck, UserX, Loader2, Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import Modal from '../components/UI/Modal';
import ConfirmModal from '../components/UI/ConfirmModal';
import { useAuth } from '../context/AuthContext';

// S1: Use crypto.getRandomValues() instead of Math.random() for cryptographic security
function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const arr = new Uint8Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

const ROLES = ['admin', 'lead', 'engineer', 'viewer'];

export default function UserManagement() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'engineer', department: '', active: 1 });
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // L1: State for confirm modal before deactivate/activate
  const [confirmToggle, setConfirmToggle] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  // L2: Wrap load() in try/catch with error toast
  const load = async () => {
    try {
      const r = await api.get('/users');
      setUsers(r.data);
    } catch {
      toast.error('Failed to load users');
    }
  };
  useEffect(() => { load(); }, []);

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

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/users/${editing.id}`, { ...form, ...(password ? { password } : {}) });
        toast.success('User updated successfully');
      } else {
        await api.post('/users', { ...form, password });
        toast.success('User created successfully');
      }
      closeModal(); load();
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

  // L1: Instead of calling the API directly, show a confirm modal first.
  // S2: Note — the server must also enforce "cannot deactivate own account" to prevent bypass via direct API calls.
  const toggleActive = (u: any) => {
    if (u.id === user?.id) { toast.error('You cannot deactivate your own account.'); return; }
    setConfirmToggle(u);
  };

  const confirmToggleActive = async () => {
    if (!confirmToggle) return;
    setToggling(true);
    try {
      await api.put(`/users/${confirmToggle.id}`, { ...confirmToggle, active: confirmToggle.active ? 0 : 1 });
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

      {/* Role summary */}
      <div className="grid grid-cols-4 gap-4">
        {ROLES.map(r => (
          <div key={r} className="card p-4 text-center">
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{roleCount(r)}</div>
            <span className={`badge-${r} mt-1 inline-flex`}>{r === 'admin' ? 'QA Admin' : r === 'lead' ? 'QA Lead' : r === 'engineer' ? 'QA Engineer' : 'Viewer'}</span>
          </div>
        ))}
      </div>

      {/* Permission Matrix */}
      <div className="card p-5">
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-4">Permission Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Permission</th>
                {['QA Admin', 'QA Lead', 'QA Engineer', 'Viewer'].map(r => <th key={r} className="py-2 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase text-center">{r}</th>)}
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
                      {/* U3: Fallback to dicebear avatar on broken image URLs */}
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.email)}`; }} />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge-${u.role}`}>
                      {u.role === 'admin' ? 'QA Admin' : u.role === 'lead' ? 'QA Lead' : u.role === 'engineer' ? 'QA Engineer' : 'Viewer'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="badge-approved">Active</span>
                    ) : (
                      <span className="badge-archived">Inactive</span>
                    )}
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

      {/* L1: Confirm modal for activate/deactivate */}
      <ConfirmModal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={confirmToggleActive}
        title={confirmToggle?.active ? 'Deactivate User' : 'Activate User'}
        message={`Are you sure you want to ${confirmToggle?.active ? 'deactivate' : 'activate'} ${confirmToggle?.name}?`}
        confirmLabel={confirmToggle?.active ? 'Deactivate' : 'Activate'}
        loading={toggling}
      />

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
          {/* L4: Show email as read-only when editing */}
          {editing && (
            <div>
              <label className="label">Email</label>
              <input className="input bg-slate-50 dark:bg-slate-800" value={form.email} disabled readOnly />
            </div>
          )}
          <div>
            <label className="label">Role<span className="text-red-500 ml-0.5">*</span></label>
            <select value={form.role} onChange={e => { setForm(p => ({ ...p, role: e.target.value })); if (errors.role) setErrors(p => ({ ...p, role: '' })); }} className={`input ${errors.role ? 'border-red-400 focus:ring-red-300' : ''}`}>
              <option value="admin">QA Admin</option>
              <option value="lead">QA Lead</option>
              <option value="engineer">QA Engineer</option>
              <option value="viewer">Viewer</option>
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>
          <div>
            <label className="label">Department</label>
            <input value={form.department} onChange={e => { setForm(p => ({ ...p, department: e.target.value })); if (errors.department) setErrors(p => ({ ...p, department: '' })); }} className={`input ${errors.department ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="QA Department" />
            {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
          </div>

          {/* Password — required for create, optional for edit */}
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
    </div>
  );
}
