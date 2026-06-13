import { useEffect, useRef } from 'react';

interface BadgeProps { status: string; }

const labels: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
  admin: 'Admin',
  lead: 'Lead',
  engineer: 'Engineer',
  viewer: 'Viewer',
};

const ACTIVE_STATUSES = new Set(['in_progress', 'under_review', 'submitted']);

export default function StatusBadge({ status }: BadgeProps) {
  const label = labels[status] || status;
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    el.classList.add('anim-flash-amber');
    const timer = setTimeout(() => el.classList.remove('anim-flash-amber'), 600);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <span ref={spanRef} className={`badge badge-${status}`}>
      {ACTIVE_STATUSES.has(status) && (
        <span
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'rotateRing 0.8s linear infinite',
            marginRight: 4,
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
}
