import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, UserCheck, UserX } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/UI/Modal';

const ROLES = ['admin', 'lead', 'engineer', 'viewer'];
const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  engineer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'engineer', department: '', active: 1 });

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (editing) {
      await api.put(`/users/${editing.id}`, form);
    } else {
      await api.post('/users', { ...form, password: 'password123' });
    }
    setShowModal(false); setEditing(null); setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 }); load();
  };

  const startEdit = (u: any) => {
    setEditing(u); setForm({ name: u.name, email: u.email, role: u.role, department: u.department, active: u.active }); setShowModal(true);
  };

  const toggleActive = async (u: any) => {
    await api.put(`/users/${u.id}`, { ...u, active: u.active ? 0 : 1 }); load();
  };

  const roleCount = (role: string) => users.filter(u => u.role === role).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage team members and access control</p>
        </div>
        <button onClick={() => { setEditing(null); setForm({ name: '', email: '', role: 'engineer', department: '', active: 1 }); setShowModal(true); }} className="btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-4 gap-4">
        {ROLES.map(r => (
          <div key={r} className="card p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{roleCount(r)}</div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize mt-1 inline-block ${ROLE_STYLES[r]}`}>{r === 'admin' ? 'QA Admin' : r === 'lead' ? 'QA Lead' : r === 'engineer' ? 'QA Engineer' : 'Viewer'}</span>
          </div>
        ))}
      </div>

      {/* Permission Matrix */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Permission Matrix</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Permission</th>
                {['QA Admin', 'QA Lead', 'QA Engineer', 'Viewer'].map(r => <th key={r} className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-center">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
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
                <tr key={label as string} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 text-sm font-medium">{label as string}</td>
                  {(perms as boolean[]).map((p, i) => (
                    <td key={i} className="py-2.5 px-3 text-center">
                      {p ? <span className="text-green-500 text-lg">✓</span> : <span className="text-gray-300 dark:text-gray-600 text-lg">✗</span>}
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
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                {['User', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">{u.name}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${ROLE_STYLES[u.role]}`}>
                      {u.role === 'admin' ? 'QA Admin' : u.role === 'lead' ? 'QA Lead' : u.role === 'engineer' ? 'QA Engineer' : 'Viewer'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>
                    ) : (
                      <span className="badge bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEdit(u)} title="Edit" className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"><Edit2 size={14} /></button>
                      <button onClick={() => toggleActive(u)} title={u.active ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${u.active ? 'text-red-400' : 'text-green-500'}`}>
                        {u.active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit User' : 'Add New User'} size="sm">
        <div className="space-y-4">
          <div><label className="label">Full Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="John Doe" /></div>
          {!editing && <div><label className="label">Email *</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" placeholder="john@company.com" /></div>}
          <div>
            <label className="label">Role</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="input">
              <option value="admin">QA Admin</option>
              <option value="lead">QA Lead</option>
              <option value="engineer">QA Engineer</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <div><label className="label">Department</label><input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} className="input" placeholder="QA Department" /></div>
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary">{editing ? 'Save Changes' : 'Create User'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
