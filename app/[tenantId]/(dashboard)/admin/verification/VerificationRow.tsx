'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import StatusBadge, { type Status } from '@/app/components/ui/StatusBadge';

interface VerificationRowProps {
  tenantId: string;
  userId: string;
  name: string;
  brokerage: string;
  rera: string;
  joined: string;
  status: 'pending' | 'verified' | 'rejected';
  hasLicense: boolean;
  onApprove: (tenantId: string, userId: string, verified: boolean) => Promise<{ error?: string }>;
  onReject: (tenantId: string, userId: string) => Promise<{ error?: string }>;
  onViewLicense: (tenantId: string, userId: string) => Promise<{ url?: string; error?: string }>;
}

export default function VerificationRow({
  tenantId,
  userId,
  name,
  brokerage,
  rera,
  joined,
  status,
  hasLicense,
  onApprove,
  onReject,
  onViewLicense,
}: VerificationRowProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function approve() {
    startTransition(async () => {
      await onApprove(tenantId, userId, true);
      router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      await onReject(tenantId, userId);
      router.refresh();
    });
  }

  function viewLicense() {
    startTransition(async () => {
      const result = await onViewLicense(tenantId, userId);
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    });
  }

  return (
    <tr className="border-b border-ink/5 last:border-0">
      <td className="px-5 py-3 font-medium text-ink">{name}</td>
      <td className="px-5 py-3 text-muted">{brokerage}</td>
      <td className="px-5 py-3 text-muted">{rera}</td>
      <td className="px-5 py-3 text-muted">{new Date(joined).toLocaleDateString()}</td>
      <td className="px-5 py-3">
        <StatusBadge status={status as Status} />
      </td>
      <td className="px-5 py-3 text-end">
        <button
          disabled={isPending || !hasLicense}
          onClick={viewLicense}
          className="me-2 rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-40"
        >
          {hasLicense ? 'View license' : 'No license on file'}
        </button>
        {status !== 'verified' && (
          <button
            disabled={isPending}
            onClick={approve}
            className="me-2 rounded-full bg-terracotta px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Approve
          </button>
        )}
        {status !== 'rejected' && (
          <button
            disabled={isPending}
            onClick={reject}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-muted hover:text-ink disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </td>
    </tr>
  );
}
