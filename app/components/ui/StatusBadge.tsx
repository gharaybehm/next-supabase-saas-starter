export type Status = 'active' | 'pending' | 'sold' | 'expired' | 'verified' | 'rejected' | 'closed';

const STATUS_STYLE: Record<Status, { color: string; bg: string }> = {
  active: { color: 'var(--color-status-active)', bg: 'var(--color-status-active-bg)' },
  pending: { color: 'var(--color-status-pending)', bg: 'var(--color-status-pending-bg)' },
  sold: { color: 'var(--color-status-sold)', bg: 'var(--color-status-sold-bg)' },
  expired: { color: 'var(--color-status-expired)', bg: 'var(--color-status-expired-bg)' },
  verified: { color: 'var(--color-status-active)', bg: 'var(--color-status-active-bg)' },
  rejected: { color: 'var(--color-status-rejected)', bg: 'var(--color-status-rejected-bg)' },
  closed: { color: 'var(--color-status-active)', bg: 'var(--color-status-active-bg)' },
};

interface StatusBadgeProps {
  status: Status;
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
      style={{ color: style.color, backgroundColor: style.bg }}
    >
      {label ?? status}
    </span>
  );
}
