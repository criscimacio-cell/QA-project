import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, UserCheck, UserX } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

const ROLES = ['admin', 'lead', 'engineer', 'viewer'];

export default function UserManagement() {
  const { isAdmin, user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'engineer', department: '', active: 1 });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!editing) {
      if (!form.email.trim()) e.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Enter a valid email address';
    }
    if (!form.role) e.role = 'Role is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setErrors({}); setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 }); };

  const save = async () => {
    if (!validate()) return;
    if (editing) {
      await api.put(`/users/${editing.id}`, form);
    } else {
      await api.post('/users', { ...form, password: 'password123' });
    }
    closeModal(); load();
  };

  const startEdit = (u: any) => {
    setEditing(u); setErrors({}); setForm({ name: u.name || '', email: u.email || '', role: u.role || 'engineer', department: u.department || '', active: u.active }); setShowModal(true);
  };

  const toggleActive = async (u: any) => {
    if (u.id === user?.id) { alert("You cannot deactivate your own account."); return; }
    await api.put(`/users/${u.id}`, { ...u, active: u.active ? 0 : 1 }); load();
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
          <button onClick={() => { setEditing(null); setErrors({}); setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 }); setShowModal(true); }} className="btn-primary">
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
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0" />
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
          <div><label className="label">Department</label><input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="input" placeholder="QA Department" /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={closeModal} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary">{editing ? 'Save Changes' : 'Create User'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
