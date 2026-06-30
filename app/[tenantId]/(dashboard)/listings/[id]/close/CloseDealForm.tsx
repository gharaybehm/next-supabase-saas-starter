'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { closeDeal } from '@/app/actions/deals';

interface Member {
  user_id: string;
  full_name: string;
  rera_card_no: string;
  brokerage_name: string;
}

interface Props {
  tenantId: string;
  listingId: string;
  members: Member[];
  defaultListingPct: number;
  defaultCoopPct: number;
}

export default function CloseDealForm({ tenantId, listingId, members, defaultListingPct, defaultCoopPct }: Props) {
  const t = useTranslations('deals');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split('T')[0];
  const [coopBrokerId, setCoopBrokerId] = useState('');
  const [listingPct, setListingPct] = useState(defaultListingPct);
  const [coopPct, setCoopPct] = useState(defaultCoopPct);

  function handleCoopChange(val: string) {
    setCoopBrokerId(val);
    if (!val) {
      setListingPct(100);
      setCoopPct(0);
    } else {
      setListingPct(defaultListingPct);
      setCoopPct(defaultCoopPct);
    }
  }

  function handleListingPctChange(val: number) {
    setListingPct(val);
    if (coopBrokerId) setCoopPct(Math.round((100 - val) * 100) / 100);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await closeDeal(tenantId, listingId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.push(`/${tenantId}/listings/${listingId}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/50 space-y-5">
      {/* Cooperating broker */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          {t('cooperatingBrokerLabel')}
        </label>
        <select
          name="cooperating_broker_id"
          value={coopBrokerId}
          onChange={(e) => handleCoopChange(e.target.value)}
          className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">{t('selfDeal')}</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name} — RERA {m.rera_card_no}
            </option>
          ))}
        </select>
      </div>

      {/* Commission split */}
      <div>
        <p className="text-sm font-medium text-zinc-700 mb-2">{t('splitsLabel')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">{t('listingSplit')}</label>
            <div className="relative">
              <input
                type="number"
                name="listing_commission_pct"
                value={listingPct}
                onChange={(e) => handleListingPctChange(Number(e.target.value))}
                min={0}
                max={100}
                step={0.5}
                required
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 pr-8 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">{t('cooperatingSplit')}</label>
            <div className="relative">
              <input
                type="number"
                name="cooperating_commission_pct"
                value={coopPct}
                onChange={(e) => setCoopPct(Number(e.target.value))}
                min={0}
                max={100}
                step={0.5}
                disabled={!coopBrokerId}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 pr-8 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-zinc-50 disabled:text-zinc-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">%</span>
            </div>
          </div>
        </div>
        {coopBrokerId && Math.abs(listingPct + coopPct - 100) > 0.01 && (
          <p className="mt-1.5 text-xs text-red-600">Splits must sum to 100%</p>
        )}
      </div>

      {/* Closed date */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          {t('closedDate')}
        </label>
        <input
          type="date"
          name="closed_at"
          defaultValue={todayISO}
          required
          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1.5">
          {t('notesLabel')}
        </label>
        <textarea
          name="notes"
          placeholder={t('notesPlaceholder')}
          rows={3}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-zinc-300 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          {t('cancel')}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? '…' : t('confirm')}
        </button>
      </div>
    </form>
  );
}
