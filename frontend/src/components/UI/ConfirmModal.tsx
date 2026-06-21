import { Loader2, AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  variant = 'danger',
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      box: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'text-red-500',
      text: 'text-red-700 dark:text-red-400',
      button: 'bg-red-500 hover:bg-red-600',
    },
    warning: {
      box: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      icon: 'text-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      button: 'bg-amber-500 hover:bg-amber-600',
    },
    info: {
      box: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'text-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
      button: 'bg-blue-500 hover:bg-blue-600',
    },
  }[variant];

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-5">
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${variantStyles.box}`}>
          <AlertTriangle size={18} className={`${variantStyles.icon} flex-shrink-0 mt-0.5`} />
          <p className={`text-sm ${variantStyles.text}`}>{message}</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold ${variantStyles.button} text-white transition-colors disabled:opacity-60`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
