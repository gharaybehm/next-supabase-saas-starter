interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md';
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
};

export default function Card({ children, className = '', padding = 'md' }: CardProps) {
  return (
    <div className={`rounded-2xl bg-card ring-1 ring-ink/10 shadow-sm ${PADDING[padding]} ${className}`}>
      {children}
    </div>
  );
}
