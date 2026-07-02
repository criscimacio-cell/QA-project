import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  className?: string;
}

export default function Pagination({ total, limit, offset, onPageChange, className = '' }: PaginationProps) {
  if (total <= limit) return null;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const go = (page: number) => onPageChange((page - 1) * limit);

  return (
    <div className={`flex items-center justify-between text-sm ${className}`}>
      <span className="text-slate-500 dark:text-slate-400 text-xs">
        {offset + 1}–{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-500 dark:text-slate-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => go(p as number)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                p === currentPage
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => go(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
