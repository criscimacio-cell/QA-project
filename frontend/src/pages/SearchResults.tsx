import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, FileText, BookOpen, Download, Loader2, Bookmark, X } from 'lucide-react';
import Pagination from '../components/UI/Pagination';

const PAGE_SIZE = 10;
import { toast } from 'sonner';
import api from '../api/client';
import { downloadWithPasswordPrompt } from '../utils/download';
import FileIcon from '../components/UI/FileIcon';
import StatusBadge from '../components/UI/Badge';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function highlight(text: string, q: string) {
  if (!q || !text) return escapeHtml(text || '');
  // escapeHtml first so injected text can never break out of the mark tag
  const escaped = escapeHtml(text);
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${safeQ})`, 'gi');
  return escaped.replace(re, '<mark class="bg-yellow-200 dark:bg-yellow-700/70 dark:text-white rounded px-0.5">$1</mark>');
}

// Safe highlighted span — only use dangerouslySetInnerHTML for the highlight markup;
// the content has been HTML-escaped so no raw user HTML survives.
function HL({ text, q }: { text: string; q: string }) {
  return <span dangerouslySetInnerHTML={{ __html: highlight(text, q) }} />;
}

function formatBytes(b: number) {
  if (b > 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b > 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const q = params.get('q') || '';
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [filesOffset, setFilesOffset] = useState(0);
  const [knowledgeOffset, setKnowledgeOffset] = useState(0);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [savedSearchesLoading, setSavedSearchesLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    setQuery(q);
    setFilesOffset(0);
    setKnowledgeOffset(0);
    setLoading(true);
    api.get('/search', { params: { q, type: filter === 'all' ? undefined : filter } })
      .then(r => setResults(r.data))
      .catch(() => {
        toast.error('Search failed. Please try again.');
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [q, filter]);

  useEffect(() => {
    setSavedSearchesLoading(true);
    api.get('/saved-searches')
      .then(r => setSavedSearches(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setSavedSearchesLoading(false));
  }, []);

  const saveSearch = async () => {
    if (!q) return;
    const name = prompt('Name for this saved search?');
    if (!name?.trim()) return;
    try {
      const r = await api.post('/saved-searches', { name: name.trim(), query: q, filters: {} });
      setSavedSearches(prev => [...prev, r.data]);
      toast.success('Search saved');
    } catch {
      toast.error('Failed to save search');
    }
  };

  const deleteSavedSearch = async (id: number) => {
    try {
      await api.delete(`/saved-searches/${id}`);
      setSavedSearches(prev => prev.filter(s => s.id !== id));
      toast.success('Saved search deleted');
    } catch {
      toast.error('Failed to delete saved search');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="flex gap-6 animate-fade-in-up">
      {/* Saved Searches Sidebar */}
      <div className="w-56 shrink-0 space-y-3">
        <div className="card p-3">
          <div className="flex items-center gap-2 mb-3">
            <Bookmark size={14} className="text-amber-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Saved Searches</span>
          </div>
          {q && (
            <button onClick={saveSearch} className="w-full btn-primary text-xs py-1.5 mb-3 flex items-center gap-1.5 justify-center">
              <Bookmark size={12} /> Save This Search
            </button>
          )}
          {savedSearchesLoading ? (
            <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-amber-400" /></div>
          ) : savedSearches.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-2">No saved searches</p>
          ) : (
            <div className="space-y-1">
              {savedSearches.map(s => (
                <div key={s.id} className="flex items-center gap-1 group">
                  <button
                    onClick={() => navigate(`/search?q=${encodeURIComponent(s.query)}`)}
                    className="flex-1 text-left text-xs text-slate-600 dark:text-slate-300 hover:text-amber-500 truncate py-1 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    title={s.query}
                  >
                    {s.name}
                  </button>
                  <button
                    onClick={() => deleteSavedSearch(s.id)}
                    className="p-1 rounded text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-4xl space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative">
        <label htmlFor="sr-search" className="sr-only">Search</label>
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="sr-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="input pl-12 pr-4 py-4 text-base rounded-2xl shadow-sm"
          placeholder="Search files, articles, Jira tickets, tags..."
        />
        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 btn-primary py-2 px-4 text-sm">Search</button>
      </form>

      {/* Filter tabs */}
      {results && (
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: `All (${results.total})` },
            { id: 'files', label: `Files (${results.files?.length || 0})` },
            { id: 'knowledge', label: `Knowledge (${results.knowledge?.length || 0})` },
          ].map(f => (
            <button key={f.id} onClick={() => { setFilter(f.id); setFilesOffset(0); setKnowledgeOffset(0); }} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${filter === f.id ? 'bg-[#F59E0B] text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* No query */}
      {!q && (
        <div className="card p-12 text-center">
          <Search size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Search Qlarity</p>
          <p className="text-sm mt-1 text-slate-400">Search across files, knowledge articles, Jira tickets, tags, and more</p>
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {['report', 'template', 'contract', 'RCA', 'PROJ-123'].map(s => (
              <button key={s} onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)} className="text-sm bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 text-slate-600 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 px-3 py-1.5 rounded-full transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-500 mx-auto" />
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Found <strong>{results.total}</strong> results for "<strong>{q}</strong>"
          </p>

          {results.total === 0 && (
            <div className="card p-8 text-center">
              <p className="font-medium text-slate-600 dark:text-slate-300">No results found</p>
              <p className="text-sm mt-1 text-slate-400">Try different keywords or check the spelling</p>
            </div>
          )}

          {/* File results */}
          {(filter === 'all' || filter === 'files') && results.files?.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <FileText size={18} className="text-[#F59E0B]" /> Files
              </h2>
              {results.files.slice(filesOffset, filesOffset + PAGE_SIZE).map((f: any) => (
                <div key={f.id} className="card p-4 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-800 transition-all">
                  <div className="flex items-start gap-4">
                    <FileIcon mimeType={f.mime_type} name={f.original_name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100"><HL text={f.name} q={q} /></h3>
                        <StatusBadge status={f.status} />
                        {f.jira_ticket && (
                          <span className="text-xs text-blue-600 font-mono bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded"><HL text={f.jira_ticket} q={q} /></span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-x-3">
                        <span>{f.repository_name}</span>
                        <span>·</span>
                        <span><HL text={f.project} q={q} /></span>
                        <span>·</span>
                        <span>{f.category}</span>
                        <span>·</span>
                        <span>v{f.version}</span>
                        <span>·</span>
                        <span>{f.owner_name}</span>
                      </div>
                      {f.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2"><HL text={f.description} q={q} /></p>
                      )}
                      {f.tags && (
                        <div className="flex gap-1 flex-wrap mt-2">
                          {f.tags.split(',').map((t: string) => t.trim()).filter(Boolean).map((t: string) => (
                            <span key={t} className={`text-xs px-1.5 py-0.5 rounded border ${f.tags.toLowerCase().includes(q.toLowerCase()) ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => downloadWithPasswordPrompt(f.id, f.original_name || f.name, f.is_password_protected)} aria-label={`Download ${f.name}`} className="btn-ghost p-2 flex-shrink-0 text-teal-500">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <Pagination total={results.files.length} limit={PAGE_SIZE} offset={filesOffset} onPageChange={setFilesOffset} />
            </div>
          )}

          {/* Knowledge results */}
          {(filter === 'all' || filter === 'knowledge') && results.knowledge?.length > 0 && (
            <div className="space-y-3 mt-4">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <BookOpen size={18} className="text-amber-500" /> Knowledge Articles
              </h2>
              {results.knowledge.slice(knowledgeOffset, knowledgeOffset + PAGE_SIZE).map((a: any) => (
                <div key={a.id} className="card p-4 hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <BookOpen size={18} className="text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100"><HL text={a.title} q={q} /></h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{a.category}</span> · {a.author_name} · {new Date(a.updated_at).toLocaleDateString()}
                      </div>
                      {a.tags && (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {a.tags.split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 4).map((t: string) => (
                            <span key={t} className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 px-1.5 py-0.5 rounded">#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <Pagination total={results.knowledge.length} limit={PAGE_SIZE} offset={knowledgeOffset} onPageChange={setKnowledgeOffset} />
            </div>
          )}
        </>
      )}
      </div>{/* end main content */}
    </div>
  );
}
