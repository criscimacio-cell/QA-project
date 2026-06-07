import { ReactNode, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setClosing(false);
      // Tiny delay lets CSS reset before animating in
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  // Keyboard handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  if (!open && !closing) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 pt-20 sm:pt-20"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-all duration-300"
        style={{
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          opacity: visible && !closing ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${sizes[size]} max-h-[90vh] flex flex-col overflow-hidden rounded-2xl z-10`}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 70px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)',
          opacity: visible && !closing ? 1 : 0,
          transform: visible && !closing
            ? 'translateY(0) scale(1)'
            : 'translateY(24px) scale(0.97)',
          transition: 'opacity 0.28s cubic-bezier(0.16,1,0.3,1), transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, rgba(8,164,156,0.05), rgba(6,182,212,0.02))',
          }}
        >
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            {/* Gradient accent line */}
            <div
              className="h-0.5 w-8 rounded-full mt-1"
              style={{ background: 'linear-gradient(90deg, #08a49c, #06b6d4)' }}
            />
          </div>
          <button
            onClick={handleClose}
            className="modal-close-btn w-8 h-8 flex items-center justify-center rounded-xl"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
