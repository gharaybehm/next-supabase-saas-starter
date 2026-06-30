'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addCoBroker, removeCoBroker } from '@/app/actions/co_brokers';
import { Users, X } from 'lucide-react';

interface CoBroker {
  broker_id: string;
  full_name: string;
  rera_card_no: string;
  brokerage_name: string;
  phone?: string;
}

function buildWhatsAppUrl(phone: string | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '971' + digits.slice(1);
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

interface Member {
  user_id: string;
  full_name: string;
  rera_card_no: string;
}

interface Props {
  tenantId: string;
  listingId: string;
  currentCoBrokers: CoBroker[];
  availableMembers: Member[];
  atMaxBrokers: boolean;
}

export default function ManageCoBrokersPanel({
  tenantId,
  listingId,
  currentCoBrokers,
  availableMembers,
  atMaxBrokers,
}: Props) {
  const t = useTranslations('listings.detail');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBrokerId, setSelectedBrokerId] = useState('');

  function handleAdd() {
    if (!selectedBrokerId) return;
    setError(null);
    startTransition(async () => {
      const result = await addCoBroker(tenantId, listingId, selectedBrokerId);
      if (result.error) {
        setError(result.error);
      } else {
        setSelectedBrokerId('');
        router.refresh();
      }
    });
  }

  function handleRemove(brokerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeCoBroker(tenantId, listingId, brokerId);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-400" />
          {t('manageCoBrokersTitle')}
        </h3>
        <span className="text-xs text-zinc-400">
          {t('coBrokerSlots', { current: currentCoBrokers.length })}
        </span>
      </div>

      {/* Current co-brokers */}
      {currentCoBrokers.length === 0 ? (
        <p className="text-xs text-zinc-400 mb-4">{t('noCoBrokersYet')}</p>
      ) : (
        <ul className="space-y-2 mb-4">
          {currentCoBrokers.map((cb) => {
            const waUrl = buildWhatsAppUrl(cb.phone);
            return (
              <li key={cb.broker_id} className="flex items-center justify-between rounded-xl bg-zinc-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900">{cb.full_name}</p>
                  <p className="text-xs text-zinc-500">RERA: {cb.rera_card_no}</p>
                  {waUrl && (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#25D366] hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(cb.broker_id)}
                  disabled={isPending}
                  aria-label={t('removeCoBroker')}
                  className="ml-3 shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Add section */}
      {atMaxBrokers ? (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
          {t('maxBrokersReached')}
        </p>
      ) : (
        <div className="flex gap-2">
          <select
            value={selectedBrokerId}
            onChange={(e) => setSelectedBrokerId(e.target.value)}
            disabled={isPending || availableMembers.length === 0}
            className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-zinc-50 disabled:text-zinc-400"
          >
            <option value="">{availableMembers.length === 0 ? 'No members available' : t('selectCoBroker')}</option>
            {availableMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name} — RERA {m.rera_card_no}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !selectedBrokerId}
            className="shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {t('addCoBroker')}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
    </div>
  );
}
