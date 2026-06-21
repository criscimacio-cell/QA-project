import { useState, useEffect, useRef } from 'react';
import { BookOpen, Plus, Search, Tag, Clock, User, ChevronRight, Edit2, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api/client';
import StatusBadge from '../components/UI/Badge';
import Modal from '../components/UI/Modal';
import ConfirmModal from '../components/UI/ConfirmModal';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CATEGORIES = ['Troubleshooting', 'RCA', 'Testing Standards', 'Best Practices', 'Onboarding', 'Process Documentation'];

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const ALLOWED_TAGS = new Set(['h1','h2','h3','h4','h5','h6','p','ul','ol','li','strong','em','b','i','u','code','pre','blockquote','br','hr','span','a','table','thead','tbody','tr','th','td']);
  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    'a':  new Set(['href', 'title']),
    'td': new Set(['colspan', 'rowspan']),
    'th': new Set(['colspan', 'rowspan']),
  };
  // Schemes allowed in href
  const SAFE_HREF = /^(https?:|mailto:|#)/i;

  function clean(node: Element) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) {
        node.removeChild(child);
        continue;
      }
      const el = child as Element;
      // tagName is always uppercase for HTML elements; SVG/MathML foreign-content nodes
      // have mixed-case tagNames — treat those as disallowed too.
      const tag = el.tagName.toLowerCase();
      const isHtmlElement = el.namespaceURI === 'http://www.w3.org/1999/xhtml' || el.namespaceURI === null;
      if (!isHtmlElement || !ALLOWED_TAGS.has(tag)) {
        node.replaceChild(document.createTextNode(el.textContent || ''), el);
        continue;
      }
      // Strip all attributes not in allowlist
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        const allowed = ALLOWED_ATTRS[tag];
        if (!allowed || !allowed.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        }
      }
      // Validate href — only allow safe schemes, block javascript:, data:, vbscript:, etc.
      if (tag === 'a') {
        const href = (el.getAttribute('href') || '').trim();
        if (href && !SAFE_HREF.test(href)) el.removeAttribute('href');
        el.setAttribute('rel', 'noopener noreferrer');
        el.setAttribute('target', '_blank');
      }
      clean(el);
    }
  }
  clean(div);
  return div.innerHTML;
}

const CAT_COLORS: Record<string, string> = {
  Troubleshooting: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800',
  RCA: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  'Testing Standards': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  'Best Practices': 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 border-primary-200 dark:border-primary-800',
  Onboarding: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
  'Process Documentation': 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800',
};

export default function KnowledgeBase() {
  const { isEngineer, isLead, user } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', category: 'Best Practices', tags: '', status: 'draft' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kbCategories, setKbCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [users, setUsers] = useState<any[]>([]);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null; title: string }>({ open: false, id: null, title: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  // U1: loading state for skeleton display
  const [loading, setLoading] = useState(false);

  const load = async (overrideSearch?: string, overrideCategory?: string) => {
    const params: any = {};
    const cat = overrideCategory !== undefined ? overrideCategory : category;
    const q = overrideSearch !== undefined ? overrideSearch : search;
    if (cat !== 'All') params.category = cat;
    if (q) params.search = q;
    setLoading(true);
    try {
      const r = await api.get('/knowledge', { params });
      setArticles(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/categories', { params: { type: 'knowledge' } })
      .then(r => {
        const names = r.data.map((c: any) => c.name);
        setKbCategories(names.length > 0 ? names : DEFAULT_CATEGORIES);
      })
      .catch(() => {});
    // S3: Only fetch users (PII) for roles that need the @mention feature
    const role = (user as any)?.role;
    if (role === 'admin' || role === 'lead' || role === 'engineer') {
      api.get('/users').then(r => setUsers(r.data)).catch(() => {});
    }
  }, []);

  const insertMention = (username: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const mention = `@${username} `;
    const newValue = ta.value.slice(0, start) + mention + ta.value.slice(end);
    setForm(p => ({ ...p, content: newValue }));
    // Restore focus and cursor
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + mention.length;
    });
  };

  // L1: When category changes, reset search and reload with empty search to avoid silent carry-over
  useEffect(() => {
    setSearch('');
    load('', category);
  }, [category]);

  const openArticle = async (a: any) => {
    setArticleLoading(true);
    try {
      const r = await api.get(`/knowledge/${a.id}`);
      setSelected(r.data);
    } catch {
      toast.error('Failed to load article');
    } finally {
      setArticleLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    else if (form.title.trim().length > 200) e.title = 'Title must be 200 characters or fewer';
    if (!form.content.trim() || form.content.trim().length < 10) e.content = 'Content must be at least 10 characters';
    if (!form.category.trim()) e.category = 'Category is required';
    else if (form.category.trim().length > 100) e.category = 'Category must be 100 characters or fewer';
    if (form.tags.trim().length > 200) e.tags = 'Tags must be 200 characters or fewer';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // L2: Save article first; only create category after article succeeds (or roll back on failure)
  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    let newCategoryCreated: string | null = null;
    let newCategoryId: number | null = null;
    try {
      if (editing) {
        await api.put(`/knowledge/${editing.id}`, form);
        toast.success('Article updated');
      } else {
        // Create category first if needed, but track it so we can roll back
        if (form.category && !kbCategories.includes(form.category)) {
          const catRes = await api.post('/categories', { name: form.category, type: 'knowledge' });
          newCategoryCreated = form.category;
          newCategoryId = catRes.data?.id ?? null;
          setKbCategories(prev => [...prev, form.category]);
        }
        try {
          await api.post('/knowledge', form);
          toast.success('Article created');
        } catch (articleErr) {
          // L2: Article POST failed — roll back the newly created category
          if (newCategoryCreated !== null && newCategoryId !== null) {
            try {
              await api.delete(`/categories/${newCategoryId}`);
            } catch {
              // best-effort rollback
            }
            setKbCategories(prev => prev.filter(c => c !== newCategoryCreated));
          }
          throw articleErr;
        }
      }
      setShowCreate(false); setEditing(null); setErrors({});
      setForm({ title: '', content: '', category: 'Best Practices', tags: '', status: 'draft' });
      load();
    } catch {
      toast.error('Failed to save article. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete.id) return;
    setActionLoading(true);
    try {
      await api.delete(`/knowledge/${confirmDelete.id}`);
      toast.success('Article deleted');
      setConfirmDelete({ open: false, id: null, title: '' });
      setSelected(null);
      load();
    } catch {
      toast.error('Failed to delete article');
    } finally {
      setActionLoading(false);
    }
  };

  const doDelete = (id: number, title: string) => {
    setConfirmDelete({ open: true, id, title });
  };

  // L3: Fetch fresh data from API before opening edit form
  const startEdit = async (a: any) => {
    try {
      const r = await api.get(`/knowledge/${a.id}`);
      const fresh = r.data;
      setForm({ title: fresh.title || '', content: fresh.content || '', category: fresh.category || 'Best Practices', tags: fresh.tags || '', status: fresh.status || 'draft' });
      setEditing(fresh);
    } catch {
      // Fall back to list-row data if fetch fails
      setForm({ title: a.title || '', content: a.content || '', category: a.category || 'Best Practices', tags: a.tags || '', status: a.status || 'draft' });
      setEditing(a);
    }
    setErrors({});
    setShowCreate(true);
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Knowledge Base</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Team knowledge, guides, and documentation</p>
        </div>
        {isEngineer && (
          <button onClick={() => { setEditing(null); setErrors({}); setForm({ title: '', content: '', category: 'Best Practices', tags: '', status: 'draft' }); setShowCreate(true); }} className="btn-primary">
            <Plus size={16} /> New Article
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0 space-y-2">
          <div className="relative mb-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search articles..."
              className="input pl-8 text-sm h-8 w-full"
            />
          </div>
          {/* L1: hint so users know to press Enter */}
          <p className="text-xs text-slate-400 px-1 mb-2">Press Enter to search</p>
          {['All', ...kbCategories].map(cat => {
            const count = cat === 'All' ? articles.length : articles.filter(a => a.category === cat).length;
            return (
              <button key={cat} onClick={() => setCategory(cat)} className={`w-full text-left flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${category === cat ? 'bg-amber-200/30 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                <span>{cat}</span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full px-2">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Article List */}
        <div className="flex-1 grid grid-cols-1 gap-3">
          {/* U1: Show shimmer skeleton cards while loading */}
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
                      </div>
                      <div className="h-5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                      <div className="flex items-center gap-4">
                        <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                        <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded" />
                      </div>
                    </div>
                    <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))}
            </>
          ) : articles.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No articles found</p>
              <p className="text-xs mt-1 text-slate-400">Try a different category or search term</p>
            </div>
          ) : articles.map(a => (
            <div key={a.id} onClick={() => !articleLoading && openArticle(a)} className={`card p-5 cursor-pointer hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-800 transition-all group ${articleLoading ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {a.category && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[a.category] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{a.category}</span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">{a.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><User size={11} />{a.author_name}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{new Date(a.updated_at).toLocaleDateString()}</span>
                    {a.tags && <span className="flex items-center gap-1"><Tag size={11} />{a.tags.split(',').slice(0, 3).join(', ')}</span>}
                  </div>
                </div>
                {articleLoading ? <Loader2 size={18} className="text-amber-400 animate-spin flex-shrink-0 mt-1" /> : <ChevronRight size={18} className="text-slate-300 group-hover:text-amber-400 dark:group-hover:text-amber-300 flex-shrink-0 mt-1 transition-colors" />}
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
                {isLead && <button onClick={() => doDelete(selected.id, selected.title)} aria-label="Delete article" className="btn-ghost text-sm py-1.5 px-3 text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>}
              </div>
            </div>
            {selected.tags && (
              <div className="flex gap-2 flex-wrap">
                {selected.tags.split(',').map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                  <span key={t} className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">#{t}</span>
                ))}
              </div>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-4" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.content || '<p>No content yet.</p>') }} />
          </div>
        </Modal>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, id: null, title: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Article"
        message={`"${confirmDelete.title}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={actionLoading}
      />

      {/* Create/Edit Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditing(null); setErrors({}); }} title={editing ? 'Edit Article' : 'New Knowledge Article'} size="xl">
        <div className="space-y-4">
          <div>
            <label className="label">Title<span className="text-red-500 ml-0.5">*</span></label>
            <input value={form.title} onChange={e => { setForm(p => ({ ...p, title: e.target.value.slice(0, 200) })); if (errors.title) setErrors(p => ({ ...p, title: '' })); }} className={`input ${errors.title ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="Article title" maxLength={200} />
            <div className="flex items-center justify-between mt-0.5">
              {errors.title ? <p className="text-xs text-red-500">{errors.title}</p> : <span />}
              <p className="text-xs text-slate-400 text-right">{form.title.length}/200</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category<span className="text-red-500 ml-0.5">*</span></label>
              <input
                list="kb-category-options"
                value={form.category}
                onChange={e => { setForm(p => ({ ...p, category: e.target.value })); if (errors.category) setErrors(p => ({ ...p, category: '' })); }}
                className={`input ${errors.category ? 'border-red-400 focus:ring-red-300' : ''}`}
                placeholder="Select or type a category…"
              />
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
              <datalist id="kb-category-options">
                {kbCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="label">Tags</label>
              <input value={form.tags} onChange={e => { setForm(p => ({ ...p, tags: e.target.value.slice(0, 200) })); if (errors.tags) setErrors(p => ({ ...p, tags: '' })); }} className={`input ${errors.tags ? 'border-red-400 focus:ring-red-300' : ''}`} placeholder="tag1, tag2, tag3" maxLength={200} />
              <div className="flex items-center justify-between mt-0.5">
                {errors.tags ? <p className="text-xs text-red-500">{errors.tags}</p> : <span />}
                <p className="text-xs text-slate-400 text-right">{form.tags.length}/200</p>
              </div>
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="input">
              <option value="draft">Draft</option>
              {!isEngineer && <option value="published">Published</option>}
              {editing && !isEngineer && <option value="archived">Archived</option>}
            </select>
          </div>
          <div>
            <label className="label">Content (HTML supported)</label>
            <textarea ref={contentRef} value={form.content} onChange={e => { setForm(p => ({ ...p, content: e.target.value })); if (errors.content) setErrors(p => ({ ...p, content: '' })); }} className={`input font-mono text-xs ${errors.content ? 'border-red-400 focus:ring-red-300' : ''}`} rows={12} placeholder="<h2>Section Title</h2><p>Content here...</p>" />
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}
            <p className="text-xs text-slate-400 mt-1">Supports HTML: h2, h3, p, ul, li, strong, em, code, pre</p>
            {users.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-400 flex-shrink-0">Mention a team member:</span>
                <select
                  className="input h-7 text-xs flex-1"
                  defaultValue=""
                  onChange={e => { if (e.target.value) { insertMention(e.target.value); e.target.value = ''; } }}
                >
                  <option value="" disabled>Select user…</option>
                  {users.map((u: any) => (
                    <option key={u.id} value={u.name || u.email}>{u.name || u.email}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowCreate(false); setEditing(null); setErrors({}); }} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin mr-1" />{editing ? 'Saving...' : 'Creating...'}</> : (editing ? 'Save Changes' : 'Create Article')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
