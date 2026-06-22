import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../api/client';

interface User { id: number; name: string; avatar: string; }

interface Props {
  value: string;
  onChange: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export default function MentionInput({ value, onChange, onKeyDown, placeholder, maxLength, rows = 3, className = '', disabled }: Props) {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const closeSuggestions = useCallback(() => { setSuggestions([]); setMentionStart(null); setActiveIdx(0); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const pos = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@([\w.\- ]*)$/);

    if (match) {
      const query = match[1];
      setMentionStart(pos - match[0].length);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        try {
          const res = await api.get(`/users/mention-search?q=${encodeURIComponent(query)}`, { signal: abortRef.current.signal });
          setSuggestions(res.data);
          setActiveIdx(0);
        } catch {}
      }, 200);
    } else {
      closeSuggestions();
    }
  };

  const insertMention = (user: User) => {
    if (mentionStart === null) return;
    const pos = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(pos);
    const inserted = `@${user.name} `;
    onChange(before + inserted + after);
    closeSuggestions();
    setTimeout(() => {
      const newPos = mentionStart + inserted.length;
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(suggestions[activeIdx]); return; }
      if (e.key === 'Escape') { closeSuggestions(); return; }
    }
    onKeyDown?.(e);
  };

  useEffect(() => () => { debounceRef.current && clearTimeout(debounceRef.current); }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(closeSuggestions, 150)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
        disabled={disabled}
        className={className}
      />
      {suggestions.length > 0 && (
        <div className="absolute z-50 bottom-full mb-1 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl min-w-[200px] max-h-48 overflow-y-auto">
          {suggestions.map((u, i) => (
            <div key={u.id}
              onMouseDown={() => insertMention(u)}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${i === activeIdx ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
            >
              {u.avatar
                ? <img src={u.avatar} className="w-6 h-6 rounded-full shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0">{u.name[0]}</div>}
              <span>{u.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
