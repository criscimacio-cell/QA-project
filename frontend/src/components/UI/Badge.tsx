interface BadgeProps { status: string; }

const labels: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', under_review: 'Under Review',
  approved: 'Approved', published: 'Published', archived: 'Archived',
  admin: 'Admin', lead: 'Lead', engineer: 'Engineer', viewer: 'Viewer',
};

export default function StatusBadge({ status }: BadgeProps) {
  const label = labels[status] || status;
  const cls = `badge badge-${status}`;
  return <span className={cls}>{label}</span>;
}
