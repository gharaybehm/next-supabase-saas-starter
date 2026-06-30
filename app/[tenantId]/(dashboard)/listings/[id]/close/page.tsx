import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { getListingDetail, getCommissionConfig } from '@/app/actions/listings';
import { getTenantMembers } from '@/app/actions/deals';
import CloseDealForm from './CloseDealForm';

export const dynamic = 'force-dynamic';

export default async function CloseDealPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const t = await getTranslations('deals');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${tenantId}/listings/${id}`);

  const [listing, commission, members] = await Promise.all([
    getListingDetail(tenantId, id),
    getCommissionConfig(tenantId),
    getTenantMembers(tenantId),
  ]);

  if (!listing) notFound();
  if (listing.status !== 'active') redirect(`/${tenantId}/listings/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: membership } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  const isAdmin = membership?.role === 'admin';
  const isListingBroker = listing.listing_broker_id === user.id;
  if (!isAdmin && !isListingBroker) redirect(`/${tenantId}/listings/${id}`);

  // Exclude the listing broker from the cooperating broker dropdown
  const eligibleMembers = members.filter((m) => m.user_id !== listing.listing_broker_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userProfile: Record<string, any> = listing.user_profiles ?? {};

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">{t('markSoldTitle')}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {listing.area}
          {listing.sub_community ? ` · ${listing.sub_community}` : ''} — {userProfile.full_name}
        </p>
      </div>

      <CloseDealForm
        tenantId={tenantId}
        listingId={id}
        members={eligibleMembers}
        defaultListingPct={Number(commission.listing_pct)}
        defaultCoopPct={Number(commission.cooperating_pct)}
      />
    </div>
  );
}
