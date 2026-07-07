'use client';

import { useRouter, usePathname } from 'next/navigation';
import SegmentedControl from '@/app/components/ui/SegmentedControl';
import StatusBadge, { type Status } from '@/app/components/ui/StatusBadge';
import AvatarStack from '@/app/components/ui/AvatarStack';
import SplitBar from '@/app/components/ui/SplitBar';
import { formatAED } from '@/utils/format';
import { ChevronRight } from 'lucide-react';
import type { MyDeal } from '@/app/actions/deals';

interface ListingRow {
  id: string;
  area: string;
  sub_community?: string;
  property_type: string;
  price_aed: number;
  status: string;
  listing_brokers?: { role: string; user_profiles: { full_name: string } | null }[];
}

interface DashboardTabsProps {
  tenantId: string;
  tab: 'listings' | 'deals';
  listings: ListingRow[];
  deals: MyDeal[];
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default function DashboardTabs({ tenantId, tab, listings, deals }: DashboardTabsProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <section>
      <SegmentedControl
        options={[{ value: 'listings', label: 'My Listings' }, { value: 'deals', label: 'Deals & Commissions' }]}
        value={tab}
        onChange={(v) => router.push(`${pathname}?tab=${v}`)}
        className="mb-4"
      />

      {tab === 'listings' ? (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3 text-start">Property</th>
                <th className="px-5 py-3 text-start">Price</th>
                <th className="px-5 py-3 text-start">Status</th>
                <th className="px-5 py-3 text-start">Co-brokers</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {listings.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted">No listings yet.</td></tr>
              )}
              {listings.map((l) => {
                const coBrokers = (l.listing_brokers ?? []).filter((b) => b.role === 'cooperating');
                return (
                  <tr
                    key={l.id}
                    onClick={() => router.push(`/${tenantId}/listings/${l.id}`)}
                    className="cursor-pointer border-b border-ink/5 last:border-0 hover:bg-ink/5"
                  >
                    <td className="px-5 py-3 font-medium text-ink">
                      {l.sub_community ? `${l.sub_community}, ` : ''}{l.area}
                      <span className="ms-1 text-muted">· {l.property_type}</span>
                    </td>
                    <td className="px-5 py-3 text-ink">{formatAED(l.price_aed)}</td>
                    <td className="px-5 py-3"><StatusBadge status={l.status as Status} /></td>
                    <td className="px-5 py-3">
                      {coBrokers.length > 0 ? (
                        <AvatarStack people={coBrokers.map((b) => ({ initials: initials(b.user_profiles?.full_name), tone: 'terracotta' as const }))} />
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3 text-end"><ChevronRight className="ms-auto h-4 w-4 text-muted rtl:rotate-180" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-ink/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3 text-start">Property</th>
                <th className="px-5 py-3 text-start">Listing broker</th>
                <th className="px-5 py-3 text-start">Selling broker</th>
                <th className="px-5 py-3 text-start">Split</th>
                <th className="px-5 py-3 text-start">Commission</th>
                <th className="px-5 py-3 text-start">Status</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted">No deals yet.</td></tr>
              )}
              {deals.map((d) => (
                <tr key={d.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{d.address}</td>
                  <td className="px-5 py-3 text-muted">{d.listingBroker}</td>
                  <td className="px-5 py-3 text-muted">{d.sellingBroker}</td>
                  <td className="px-5 py-3">
                    <SplitBar listingPct={d.splitListing} sellingPct={d.splitSelling} showCaption={false} className="w-28" />
                    <span className="mt-1 block text-xs text-muted">{d.splitListing}% / {d.splitSelling}%</span>
                  </td>
                  <td className="px-5 py-3 text-ink">{formatAED(d.amount)}</td>
                  <td className="px-5 py-3"><StatusBadge status="closed" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
