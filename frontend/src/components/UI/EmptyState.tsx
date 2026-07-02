import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
