import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { getMyStats, getPlatformStats } from '@/app/actions/analytics';

export const dynamic = 'force-dynamic';

function formatAED(amount: number) {
  if (amount >= 1_000_000) {
    return `AED ${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 1_000) {
    return `AED ${(amount / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

function RankedList({ title, items, valueLabel }: {
  title: string;
  items: { label: string; value: number }[];
  valueLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-700 truncate max-w-[70%]">{item.label}</span>
                <span className="text-xs font-semibold text-zinc-900">{item.value} {valueLabel}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-100">
                <div
                  className="h-1.5 rounded-full bg-brand-500"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('dashboard.page');
  const ta = await getTranslations('dashboard.analytics');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  const isAdmin = membership?.role === 'admin';

  const [myStats, platformStats] = await Promise.all([
    getMyStats(tenantId, user.id),
    isAdmin ? getPlatformStats(tenantId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </div>

      {/* My Performance */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">{ta('myStats')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={ta('activeListings')}
            value={myStats.activeListings}
            sub={`${myStats.totalListings} ${ta('listings')} ${ta('allTime')}`}
          />
          <StatCard
            label={ta('dealsClosed')}
            value={myStats.dealsClosed}
            sub={ta('allTime')}
          />
          <StatCard
            label={ta('commissionEarned')}
            value={formatAED(myStats.commissionEarnedAed)}
            sub={ta('allTime')}
          />
        </div>
      </section>

      {/* Platform Overview — admin only */}
      {isAdmin && platformStats && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">{ta('platformOverview')}</h2>

          {/* Listing status counts */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            {(['active','pending','sold','expired'] as const).map((status) => (
              <StatCard
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={platformStats.listingsByStatus[status]}
                sub={ta('listings')}
              />
            ))}
          </div>

          {/* Deal volume */}
          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <StatCard
              label={ta('totalDeals')}
              value={platformStats.totalDeals}
              sub={`${ta('volume')}: ${formatAED(platformStats.totalVolumeAed)}`}
            />
            <StatCard
              label={`${ta('totalDeals')} · ${ta('thisMonth')}`}
              value={platformStats.thisMonthDeals}
              sub={`${ta('volume')}: ${formatAED(platformStats.thisMonthVolumeAed)}`}
            />
          </div>

          {/* Ranked lists */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RankedList
              title={ta('topBrokers')}
              items={platformStats.topBrokers.map((b) => ({ label: b.full_name, value: b.dealCount }))}
              valueLabel={ta('deals')}
            />
            <RankedList
              title={ta('topAreas')}
              items={platformStats.topAreas.map((a) => ({ label: a.area, value: a.listingCount }))}
              valueLabel={ta('listings')}
            />
          </div>
        </section>
      )}
    </div>
  );
}
