interface SplitBarProps {
  listingPct: number;
  sellingPct: number;
  listingLabel?: string;
  sellingLabel?: string;
  showCaption?: boolean;
  className?: string;
}

export default function SplitBar({
  listingPct,
  sellingPct,
  listingLabel = 'Listing broker',
  sellingLabel = 'Selling broker',
  showCaption = true,
  className = '',
}: SplitBarProps) {
  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div className="bg-terracotta" style={{ width: `${listingPct}%` }} />
        <div className="bg-ink" style={{ width: `${sellingPct}%` }} />
      </div>
      {showCaption && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{listingLabel}: {listingPct}%</span>
          <span>{sellingLabel}: {sellingPct}%</span>
        </div>
      )}
    </div>
  );
}
