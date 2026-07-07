import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { getListingDetail, getCommissionConfig } from '@/app/actions/listings';
import { getDeal } from '@/app/actions/deals';
import { getTenantMembers } from '@/app/actions/deals';
import { ArrowLeft, BedDouble, Bath, Maximize2, FileText, Download, Grid2X2 } from 'lucide-react';
import ListingImageGallery from './components/ListingImageGallery';
import AddPhotosPanel from './components/AddPhotosPanel';
import ManageCoBrokersPanel from './components/ManageCoBrokersPanel';
import DescriptionToggle from './components/DescriptionToggle';
import StatusBadge, { type Status } from '@/app/components/ui/StatusBadge';
import { Pill } from '@/app/components/ui/Chip';
import Card from '@/app/components/ui/Card';
import SplitBar from '@/app/components/ui/SplitBar';
import { formatAED } from '@/utils/format';

export const dynamic = 'force-dynamic';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-AE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildWhatsAppUrl(phone: string | undefined, message: string): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = '971' + digits.slice(1)
  if (!digits) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
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

  const [listing, commission, deal] = await Promise.all([
    getListingDetail(tenantId, id),
    getCommissionConfig(tenantId),
    getDeal(tenantId, id),
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

  const tenantMembers = canManage && listing.status !== 'sold' ? await getTenantMembers(tenantId) : [];
  const existingBrokerIds = new Set([
    listing.listing_broker_id,
    ...coBrokers.map((cb) => cb.broker_id as string),
  ]);
  const availableMembers = tenantMembers.filter((m) => !existingBrokerIds.has(m.user_id));

  const listingPct = listing.split_listing_pct ?? commission.listing_pct;
  const cooperatingPct = listing.split_cooperating_pct ?? commission.cooperating_pct;
  const showSharedBadge = listing.status === 'active' || listing.status === 'pending';

  return (
    <div className="mx-auto max-w-4xl space-y-6 lg:ms-auto lg:me-0 lg:max-w-3xl">
      {/* Back */}
      <Link
        href={`/${tenantId}/listings`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink transition-colors"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t('title')}
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Images */}
          <ListingImageGallery
            images={((listing.listing_images ?? []) as { storage_path: string; display_order: number }[])
              .sort((a, b) => a.display_order - b.display_order)}
          />

          <Card className="space-y-5">
            {/* Status + Type + shared badge */}
            <div className="flex items-center gap-2">
              <StatusBadge status={listing.status as Status} label={t(`status.${listing.status}`)} />
              <span className="text-sm text-muted">{t(`propertyTypes.${listing.property_type}`)}</span>
              {showSharedBadge && <Pill>Shared with network</Pill>}
            </div>

            {/* Location + Price */}
            <div>
              <p className="font-heading text-3xl font-bold text-ink">{formatAED(listing.price_aed)}</p>
              <p className="mt-1 text-sm text-muted">
                {listing.sub_community ? `${listing.sub_community}, ` : ''}{listing.area}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" />
                {listing.bedrooms} {t('detail.beds')}
              </span>
              <span className="flex items-center gap-1.5">
                <Bath className="h-4 w-4" />
                {listing.bathrooms} {t('detail.baths')}
              </span>
              <span className="flex items-center gap-1.5">
                <Maximize2 className="h-4 w-4" />
                {Number(listing.size_sqft).toLocaleString()} {t('card.sqft')}
              </span>
            </div>

            {/* DLD Permit */}
            <div className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3 text-sm">
              <Grid2X2 className="h-5 w-5 shrink-0 text-muted" />
              <span className="text-muted">{t('detail.dldPermit')}:</span>
              <span className="font-mono font-semibold text-ink">{listing.dld_permit_no}</span>
              <StatusBadge status="verified" label="Verified" className="ms-auto" />
            </div>

            <DescriptionToggle descriptionEn={listing.description_en} descriptionAr={listing.description_ar} />

            {/* Virtual tour */}
            {listing.virtual_tour_url && (
              <a
                href={listing.virtual_tour_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-terracotta hover:opacity-80"
              >
                <FileText className="h-4 w-4" />
                Virtual Tour
              </a>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Commission */}
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-ink">{t('detail.commissionTitle')}</h3>
            <SplitBar
              listingPct={listingPct}
              sellingPct={cooperatingPct}
              listingLabel={t('detail.listingBrokerPct')}
              sellingLabel={t('detail.cooperatingPct')}
            />
          </Card>

          {/* Deal summary — shown when sold */}
          {listing.status === 'sold' && deal && (
            <Card className="ring-[color:var(--color-status-active)]/20">
              <h3 className="mb-4 text-sm font-semibold text-ink">{tDeals('dealSummaryTitle')}</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">{tDeals('closedDate')}</span>
                  <span className="font-medium text-ink">{formatDate(deal.closed_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{tDeals('cooperatingBrokerLabel')}</span>
                  <span className="font-medium text-ink">
                    {deal.cooperating_broker_user?.full_name ?? tDeals('selfDeal')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">{tDeals('listingSplit')}</span>
                  <span className="font-medium text-ink">{deal.listing_commission_pct}%</span>
                </div>
                {deal.cooperating_broker_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">{tDeals('cooperatingSplit')}</span>
                    <span className="font-medium text-ink">{deal.cooperating_commission_pct}%</span>
                  </div>
                )}
              </div>
              {canManage && (
                <a
                  href={`/api/${tenantId}/deals/${deal.id}/commission-pdf`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  <Download className="h-4 w-4" />
                  {tDeals('downloadStatement')}
                </a>
              )}
            </Card>
          )}

          {/* Authorized brokers */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-ink">{t('detail.coBrokers')}</h3>

            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                {(userProfile.full_name ?? 'B').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{userProfile.full_name ?? 'Broker'}</p>
                  <Pill tone="muted">Primary lister</Pill>
                </div>
                <p className="text-xs text-muted">RERA: {brokerProfile.rera_card_no}</p>
                <p className="text-xs text-muted">{brokerProfile.brokerage_name}</p>
                {!isListingBroker && (() => {
                  const waUrl = buildWhatsAppUrl(
                    userProfile.phone as string | undefined,
                    `Inquiring about ${listing.area}${listing.sub_community ? ' · ' + listing.sub_community : ''} – DLD Permit ${listing.dld_permit_no} (via Rabita)`
                  )
                  return waUrl ? (
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1ebe5d] transition-colors"
                    >
                      {t('detail.messageButton')}
                    </a>
                  ) : null
                })()}
              </div>
            </div>

            {canManage && listing.status !== 'sold' ? (
              <ManageCoBrokersPanel
                tenantId={tenantId}
                listingId={id}
                currentCoBrokers={coBrokers.map((cb) => ({
                  broker_id: cb.broker_id as string,
                  full_name: cb.user_profiles?.full_name ?? 'Unknown',
                  rera_card_no: cb.broker_profiles?.rera_card_no ?? '',
                  brokerage_name: cb.broker_profiles?.brokerage_name ?? '',
                  phone: cb.user_profiles?.phone ?? undefined,
                }))}
                availableMembers={availableMembers}
                atMaxBrokers={coBrokers.length >= 2}
              />
            ) : (
              coBrokers.map((lb) => {
                const waUrl = buildWhatsAppUrl(
                  lb.user_profiles?.phone as string | undefined,
                  `Inquiring about ${listing.area}${listing.sub_community ? ' · ' + listing.sub_community : ''} – DLD Permit ${listing.dld_permit_no} (via Rabita)`
                )
                return (
                  <div key={lb.broker_id} className="flex items-start gap-3 border-t border-ink/5 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta text-xs font-semibold text-white">
                      {(lb.user_profiles?.full_name ?? '?').substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink">{lb.user_profiles?.full_name}</p>
                      <p className="text-xs text-muted">RERA: {lb.broker_profiles?.rera_card_no}</p>
                      {lb.broker_profiles?.brokerage_name && (
                        <p className="text-xs text-muted">{lb.broker_profiles.brokerage_name}</p>
                      )}
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1ebe5d] transition-colors"
                        >
                          {t('detail.messageButton')}
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </Card>

          {/* Add photos (listing broker / admin only, active listings) */}
          {canManage && listing.status !== 'sold' && (
            <AddPhotosPanel tenantId={tenantId} listingId={id} />
          )}

          {/* Actions for listing broker / admin */}
          {canManage && listing.status !== 'sold' && (
            <Card className="space-y-3">
              <Link
                href={`/${tenantId}/listings/${id}/edit`}
                className="block w-full rounded-full border border-ink/15 py-2.5 text-center text-sm font-semibold text-ink hover:bg-ink/5 transition-colors"
              >
                {t('detail.editListing')}
              </Link>

              {listing.status === 'active' && (
                <Link
                  href={`/${tenantId}/listings/${id}/close`}
                  className="block w-full rounded-full bg-terracotta py-2.5 text-center text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  {tDeals('markSoldTitle')}
                </Link>
              )}
            </Card>
          )}

          {/* Meta */}
          <div className="space-y-1 px-1 text-xs text-muted">
            <p>Listed: {formatDate(listing.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
