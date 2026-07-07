import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getMyStats, getPlatformStats } from '@/app/actions/analytics';
import { getListings } from '@/app/actions/listings';
import { getMyDeals } from '@/app/actions/deals';
import { formatAED } from '@/utils/format';
import StatCard from '@/app/components/ui/StatCard';
import DashboardTabs from './DashboardTabs';

export const dynamic = 'force-dynamic';

function RankedList({ title, items, valueLabel }: {
  title: string;
  items: { label: string; value: number }[];
  valueLabel: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
      <h3 className="mb-4 text-sm font-semibold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-muted">No data yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="max-w-[70%] truncate text-sm text-ink">{item.label}</span>
                <span className="text-xs font-semibold text-ink">{item.value} {valueLabel}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-ink/10">
                <div className="h-1.5 rounded-full bg-terracotta" style={{ width: `${(item.value / max) * 100}%` }} />
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
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreement } = await (createAdminClient() as any)
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();
  const agreementSigned = agreement?.status === 'signed' || isAdmin;

  const [myStats, platformStats, myListings, myDeals] = await Promise.all([
    getMyStats(tenantId, user.id),
    isAdmin ? getPlatformStats(tenantId) : Promise.resolve(null),
    getListings(tenantId, { listing_broker_id: user.id, status: '' }),
    getMyDeals(tenantId, user.id),
  ]);

  const tab = sp.tab === 'deals' ? 'deals' : 'listings';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-ink">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
      </div>

      {/* My Performance */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{ta('myStats')}</h2>
        <div className="flex gap-4 overflow-x-auto sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          <StatCard label={ta('activeListings')} value={myStats.activeListings} sub={`${myStats.totalListings} ${ta('listings')} ${ta('allTime')}`} />
          <StatCard label="Pending deals" value={myStats.pendingListings} sub={ta('allTime')} />
          <StatCard label="Commission this month" value={formatAED(myStats.commissionThisMonthAed)} sub={ta('allTime')} />
          <StatCard
            label="Agreement status"
            value={agreementSigned ? 'Signed' : 'Pending'}
            sub={agreementSigned ? undefined : 'Sign your agreement to unlock listings'}
          />
        </div>
      </section>

      {/* Tabs */}
      <DashboardTabs
        tenantId={tenantId}
        tab={tab}
        listings={myListings}
        deals={myDeals}
      />

      {/* Platform Overview — admin only */}
      {isAdmin && platformStats && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{ta('platformOverview')}</h2>

          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['active','pending','sold','expired'] as const).map((status) => (
              <StatCard
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={platformStats.listingsByStatus[status]}
                sub={ta('listings')}
              />
            ))}
          </div>

          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <StatCard label={ta('totalDeals')} value={platformStats.totalDeals} sub={`${ta('volume')}: ${formatAED(platformStats.totalVolumeAed)}`} />
            <StatCard label={`${ta('totalDeals')} · ${ta('thisMonth')}`} value={platformStats.thisMonthDeals} sub={`${ta('volume')}: ${formatAED(platformStats.thisMonthVolumeAed)}`} />
          </div>

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
