'use client';

import { useState, useTransition } from 'react';
import { createBillingPortalSession } from '@/app/actions/billing';

export default function ManageBillingButton({ tenantId, label }: { tenantId: string; label: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createBillingPortalSession(tenantId);
            if (result.error) {
              setError(result.error);
            } else if (result.url) {
              window.location.href = result.url;
            }
          });
        }}
        className="rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white hover:bg-terracotta/90 transition-colors disabled:opacity-50"
      >
        {isPending ? '...' : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
