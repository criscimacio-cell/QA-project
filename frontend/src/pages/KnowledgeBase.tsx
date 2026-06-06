import { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Tag, Clock, User, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import api from '../api/client';
import StatusBadge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Troubleshooting', 'RCA', 'Testing Standards', 'Best Practices', 'Onboarding', 'Process Documentation'];

const CAT_COLORS: Record<string, string> = {
  Troubleshooting: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800',
  RCA: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  'Testing Standards': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'Best Practices': 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 border-primary-200 dark:border-primary-800',
  Onboarding: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
  'Process Documentation': 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200 dark:border-purple-800',
};

export default function KnowledgeBase() {
  const { isEngineer, isLead } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'Best Practices', tags: '' });

  const load = () => {
    const params: any = {};
    if (category !== 'All') params.category = category;
    if (search) params.search = search;
    api.get('/knowledge', { params }).then(r => setArticles(r.data));
  };

  useEffect(() => { load(); }, [category]);

  const openArticle = (a: any) => {
    api.get(`/knowledge/${a.id}`).then(r => setSelected(r.data));
  };

  const save = async () => {
    if (!form.title.trim()) return;
    if (editing) {
      await api.put(`/knowledge/${editing.id}`, form);
    } else {
      await api.post('/knowledge', form);
    }
    setShowCreate(false); setEditing(null);
    setForm({ title: '', content: '', category: 'Best Practices', tags: '' });
    load();
  };

  const doDelete = async (id: number) => {
    if (!confirm('Delete this article?')) return;
    await api.delete(`/knowledge/${id}`);
    setSelected(null); load();
  };

  const startEdit = (a: any) => {
    setForm({ title: a.title || '', content: a.content || '', category: a.category || 'Best Practices', tags: a.tags || '' });
    setEditing(a); setShowCreate(true);
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Team knowledge, guides, and documentation</p>
        </div>
        {isEngineer && (
          <button onClick={() => { setEditing(null); setForm({ title: '', content: '', category: 'Best Practices', tags: '' }); setShowCreate(true); }} className="btn-primary">
            <Plus size={16} /> New Article
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 space-y-2">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} placeholder="Search articles..." className="input pl-8 text-sm h-8 w-full" />
          </div>
          {CATEGORIES.map(cat => {
            const count = cat === 'All' ? articles.length : articles.filter(a => a.category === cat).length;
            return (
              <button key={cat} onClick={() => setCategory(cat)} className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${category === cat ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span>{cat}</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full px-2">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Article List */}
        <div className="flex-1 grid grid-cols-1 gap-3">
          {articles.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No articles found</p>
              <p className="text-xs mt-1 text-slate-400">Try a different category or search term</p>
            </div>
          ) : articles.map(a => (
            <div key={a.id} onClick={() => openArticle(a)} className="card p-5 cursor-pointer hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[a.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{a.category}</span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{a.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User size={11} />{a.author_name}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{new Date(a.updated_at).toLocaleDateString()}</span>
                    {a.tags && <span className="flex items-center gap-1"><Tag size={11} />{a.tags.split(',').slice(0, 3).join(', ')}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:text-teal-400 flex-shrink-0 mt-1 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Article Viewer */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.title} size="xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              {selected.category && (
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${CAT_COLORS[selected.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{selected.category}</span>
              )}
              <StatusBadge status={selected.status} />
              <span className="text-xs text-slate-400 flex items-center gap-1"><User size={11} />{selected.author_name}</span>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Clock size={11} />{new Date(selected.updated_at).toLocaleString()}</span>
              <div className="ml-auto flex gap-2">
                {isEngineer && <button onClick={() => { const a = selected; setSelected(null); startEdit(a); }} className="btn-secondary text-sm py-1.5 px-3"><Edit2 size={13} />Edit</button>}
                {isLead && <button onClick={() => doDelete(selected.id)} className="btn-ghost text-sm py-1.5 px-3 text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>}
              </div>
            </div>
            {selected.tags && (
              <div className="flex gap-2 flex-wrap">
                {selected.tags.split(',').map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                  <span key={t} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4" dangerouslySetInnerHTML={{ __html: selected.content || '<p>No content yet.</p>' }} />
          </div>
        </Modal>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditing(null); }} title={editing ? 'Edit Article' : 'New Knowledge Article'} size="xl">
        <div className="space-y-4">
          <div><label className="label">Title *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="input" placeholder="Article title" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Tags</label><input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="input" placeholder="tag1, tag2, tag3" /></div>
          </div>
          <div>
            <label className="label">Content (HTML supported)</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="input font-mono text-xs" rows={12} placeholder="<h2>Section Title</h2><p>Content here...</p>" />
            <p className="text-xs text-slate-400 mt-1">Supports HTML: h2, h3, p, ul, li, strong, em, code, pre</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setEditing(null); }} className="btn-secondary">Cancel</button>
            <button onClick={save} className="btn-primary">{editing ? 'Save Changes' : 'Create Article'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
