'use client';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

export default function Drawer({ open, onClose, children, width = 460 }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative h-full overflow-y-auto bg-paper shadow-xl"
        style={{ width: `min(100%, ${width}px)` }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute end-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-ink/10 hover:bg-zinc-50"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
