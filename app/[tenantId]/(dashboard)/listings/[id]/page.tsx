import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { getListingDetail, getCommissionConfig } from '@/app/actions/listings';
import { ArrowLeft, BedDouble, Bath, Maximize2, FileText, CheckCircle2, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatAED(amount: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const { tenantId, id } = await params;
  const t = await getTranslations('listings');
  const tDeals = await getTranslations('deals');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [listing, commission] = await Promise.all([
    getListingDetail(tenantId, id),
    getCommissionConfig(tenantId),
  ]);

  if (!listing) notFound();

  const isListingBroker = user?.id === listing.listing_broker_id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: membership } = await db.from('tenant_members').select('role').eq('tenant_id', tenantId).eq('user_id', user?.id).single();
  const isAdmin = membership?.role === 'admin';
  const canManage = isListingBroker || isAdmin;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const brokerProfile: Record<string, any> = listing.broker_profiles ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userProfile: Record<string, any> = listing.user_profiles ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coBrokers: Record<string, any>[] = (listing.listing_brokers ?? []).filter((lb: Record<string, unknown>) => lb.broker_id !== listing.listing_broker_id);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back */}
      <Link
        href={`/${tenantId}/listings`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('title')}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image placeholder */}
          <div className="h-64 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
            <Building2 className="h-20 w-20 text-brand-200" />
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200/50 space-y-5">
            {/* Status + Type */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                listing.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                listing.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                listing.status === 'sold' ? 'bg-blue-50 text-blue-700' :
                'bg-zinc-100 text-zinc-600'
              }`}>
                {t(`status.${listing.status}`)}
              </span>
              <span className="text-sm text-zinc-500">{t(`propertyTypes.${listing.property_type}`)}</span>
            </div>

            {/* Location + Price */}
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                {listing.area}
                {listing.sub_community && <span className="font-normal text-zinc-500"> · {listing.sub_community}</span>}
              </h1>
              <p className="mt-1 text-3xl font-bold text-brand-700">{formatAED(listing.price_aed)}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-zinc-600">
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-zinc-400" />
                {listing.bedrooms} {t('detail.beds')}
              </span>
              <span className="flex items-center gap-1.5">
                <Bath className="h-4 w-4 text-zinc-400" />
                {listing.bathrooms} {t('detail.baths')}
              </span>
              <span className="flex items-center gap-1.5">
                <Maximize2 className="h-4 w-4 text-zinc-400" />
                {Number(listing.size_sqft).toLocaleString()} {t('card.sqft')}
              </span>
            </div>

            {/* DLD Permit */}
            <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <span className="text-zinc-600">{t('detail.dldPermit')}:</span>
              <span className="font-mono font-semibold text-zinc-900">{listing.dld_permit_no}</span>
            </div>

            {/* Description EN */}
            {listing.description_en && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t('detail.description')} (EN)</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{listing.description_en}</p>
              </div>
            )}

            {/* Description AR */}
            {listing.description_ar && (
              <div dir="rtl" className="font-[var(--font-noto-arabic)]">
                <h3 className="text-sm font-semibold text-zinc-700 mb-2">{t('detail.description')} (AR)</h3>
                <p className="text-sm text-zinc-600 leading-relaxed">{listing.description_ar}</p>
              </div>
            )}

            {/* Virtual tour */}
            {listing.virtual_tour_url && (
              <a
                href={listing.virtual_tour_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-500"
              >
                <FileText className="h-4 w-4" />
                Virtual Tour
              </a>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Commission */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">{t('detail.commissionTitle')}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">{t('detail.listingBrokerPct')}</span>
                <span className="text-sm font-bold text-zinc-900">{commission.listing_pct}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">{t('detail.cooperatingPct')}</span>
                <span className="text-sm font-bold text-zinc-900">{commission.cooperating_pct}%</span>
              </div>
            </div>
          </div>

          {/* Listing broker */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">{t('detail.listingBroker')}</h3>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900">{userProfile.full_name ?? 'Broker'}</p>
              <p className="text-xs text-zinc-500">RERA: {brokerProfile.rera_card_no}</p>
              <p className="text-xs text-zinc-500">{brokerProfile.brokerage_name}</p>
            </div>

            {!isListingBroker && (
              <form
                action={async () => {
                  'use server';
                  const { createAdminClient } = await import('@/utils/supabase/admin');
                  const supa = await import('@/utils/supabase/server');
                  const supaServer = await supa.createClient();
                  const { data: { user: currentUser } } = await supaServer.auth.getUser();
                  if (!currentUser) return;

                  const adminDb = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

                  // Check for existing conversation
                  const { data: existing } = await adminDb
                    .from('conversations')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .contains('participant_ids', [currentUser.id, listing.listing_broker_id])
                    .maybeSingle();

                  let convId = existing?.id;
                  if (!convId) {
                    const { data: newConv } = await adminDb
                      .from('conversations')
                      .insert({
                        tenant_id: tenantId,
                        participant_ids: [currentUser.id, listing.listing_broker_id],
                        listing_id: id,
                      })
                      .select('id')
                      .single();
                    convId = newConv?.id;
                  }
                  const { redirect: redir } = await import('next/navigation');
                  if (convId) redir(`/${tenantId}/messages/${convId}`);
                }}
              >
                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
                >
                  {t('detail.messageButton')}
                </button>
              </form>
            )}
          </div>

          {/* Co-brokers */}
          {coBrokers.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">{t('detail.coBrokers')}</h3>
              {coBrokers.map((lb) => (
                <div key={lb.broker_id} className="mb-3 last:mb-0">
                  <p className="text-sm font-semibold text-zinc-900">{lb.user_profiles?.full_name}</p>
                  <p className="text-xs text-zinc-500">RERA: {lb.broker_profiles?.rera_card_no}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions for listing broker / admin */}
          {canManage && listing.status !== 'sold' && (
            <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50 space-y-3">
              <Link
                href={`/${tenantId}/listings/${id}/edit`}
                className="block w-full rounded-xl border border-zinc-300 py-2.5 text-center text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                {t('detail.editListing')}
              </Link>

              {listing.status === 'active' && (
                <Link
                  href={`/${tenantId}/listings/${id}/close`}
                  className="block w-full rounded-xl bg-blue-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
                >
                  {tDeals('markSoldTitle')}
                </Link>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-zinc-400 space-y-1 px-1">
            <p>Listed: {formatDate(listing.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
