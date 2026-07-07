'use client';

import { useState, useTransition } from 'react';
import { Minus, Plus } from 'lucide-react';
import SplitBar from '@/app/components/ui/SplitBar';

interface CommissionStepperProps {
  tenantId: string;
  initialListingPct: number;
  onUpdate: (tenantId: string, listingPct: number, cooperatingPct: number) => Promise<{ error?: string }>;
}

export default function CommissionStepper({
  tenantId,
  initialListingPct,
  onUpdate,
}: CommissionStepperProps) {
  const [listingPct, setListingPct] = useState(initialListingPct);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cooperatingPct = 100 - listingPct;

  function adjust(delta: number) {
    const next = Math.min(90, Math.max(10, listingPct + delta));
    setListingPct(next);
    startTransition(async () => {
      const result = await onUpdate(tenantId, next, 100 - next);
      setError(result.error ?? null);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => adjust(-10)}
          disabled={isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink hover:bg-ink/10 disabled:opacity-50"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="font-heading text-2xl font-bold text-ink">{listingPct}% / {cooperatingPct}%</span>
        <button
          onClick={() => adjust(10)}
          disabled={isPending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink hover:bg-ink/10 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <SplitBar listingPct={listingPct} sellingPct={cooperatingPct} className="mt-5" />

      {error && <p className="mt-3 text-center text-sm text-[color:var(--color-status-rejected)]">{error}</p>}
    </div>
  );
}
