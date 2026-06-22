interface Props {
  patch: string;
}

export default function DiffViewer({ patch }: Props) {
  const lines = patch.split('\n');

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
      <pre className="text-xs font-mono leading-5 p-0">
        {lines.map((line, i) => {
          let bg = '';
          let color = '';
          if (line.startsWith('+++') || line.startsWith('---')) {
            bg = 'bg-slate-100 dark:bg-slate-800'; color = 'text-slate-500 dark:text-slate-400';
          } else if (line.startsWith('@@')) {
            bg = 'bg-blue-50 dark:bg-blue-900/20'; color = 'text-blue-600 dark:text-blue-400';
          } else if (line.startsWith('+')) {
            bg = 'bg-emerald-50 dark:bg-emerald-900/20'; color = 'text-emerald-800 dark:text-emerald-300';
          } else if (line.startsWith('-')) {
            bg = 'bg-red-50 dark:bg-red-900/20'; color = 'text-red-800 dark:text-red-300';
          } else {
            color = 'text-slate-700 dark:text-slate-300';
          }
          return (
            <div key={i} className={`px-4 py-0 ${bg} ${color}`}>
              {line || ' '}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
