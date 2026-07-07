interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Chip({ label, active = false, onClick, className = '' }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-ink text-paper'
          : 'border border-ink/15 bg-white text-muted hover:border-ink/30'
      } ${className}`}
    >
      {label}
    </button>
  );
}

interface PillProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'terracotta' | 'status-active' | 'muted';
  className?: string;
}

export function Pill({ children, icon, tone = 'terracotta', className = '' }: PillProps) {
  const toneClass =
    tone === 'status-active'
      ? 'text-[color:var(--color-status-active)] bg-[color:var(--color-status-active-bg)]'
      : tone === 'muted'
        ? 'text-muted bg-ink/5'
        : 'text-terracotta bg-terracotta/10';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass} ${className}`}>
      {icon}
      {children}
    </span>
  );
}
