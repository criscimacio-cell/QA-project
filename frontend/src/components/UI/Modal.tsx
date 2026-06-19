import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      setClosing(false);
      requestAnimationFrame(() => {
        setVisible(true);
        // Focus first focusable element inside modal
        requestAnimationFrame(() => {
          const first = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)?.[0];
          first?.focus();
        });
      });
    } else {
      setVisible(false);
      // Restore focus to the element that opened the modal
      (previousFocus.current as HTMLElement | null)?.focus();
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Focus trap — keep Tab/Shift+Tab cycling inside the modal
  useEffect(() => {
    if (!open) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [open]);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  };

  if (!open && !closing) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4 pb-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 anim-backdrop-in transition-all duration-300"
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
        className={`relative w-full ${sizes[size]} max-h-[calc(100vh-5rem)] flex flex-col rounded-2xl z-10 anim-modal-in`}
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
            background: 'linear-gradient(135deg, rgba(245,158,11,0.05), rgba(252,211,77,0.02))',
          }}
        >
          <div>
            <h2 id="modal-title" className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <div
              className="h-0.5 w-8 rounded-full mt-1"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #FBBF24)' }}
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
    </div>,
    document.body
  );
}
