import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getListings, getCommissionConfig, type ListingFilters } from '@/app/actions/listings';
import { requireSignedAgreement } from '@/utils/requireAgreement';
import { buildImageUrl } from '@/utils/images';
import { formatAED } from '@/utils/format';
import { Plus, BedDouble, Bath, Maximize2, Building2, Link2 } from 'lucide-react';
import ListingsFilterBar from './components/ListingsFilterBar';
import StatusBadge, { type Status } from '@/app/components/ui/StatusBadge';
import { Pill } from '@/app/components/ui/Chip';
import AvatarStack from '@/app/components/ui/AvatarStack';

export const dynamic = 'force-dynamic';

function initialsFromName(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default async function ListingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const t = await getTranslations('listings');

  await requireSignedAgreement(tenantId);

  const filters: ListingFilters = {
    area: sp.area,
    property_type: sp.property_type,
    price_min: sp.price_min ? Number(sp.price_min) : undefined,
    price_max: sp.price_max ? Number(sp.price_max) : undefined,
    size_min: sp.size_min ? Number(sp.size_min) : undefined,
    bedrooms_min: sp.bedrooms_min !== undefined ? Number(sp.bedrooms_min) : undefined,
    status: sp.status || 'active',
    sort: sp.sort,
  };

  const [listings, commission, allListings] = await Promise.all([
    getListings(tenantId, filters),
    getCommissionConfig(tenantId),
    getListings(tenantId, {}),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${tenantId}/listings/new`}
          className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          {t('newListing')}
        </Link>
      </div>

      {/* Filters */}
      <ListingsFilterBar resultCount={listings.length} totalCount={allListings.length} />

      {/* Listings grid */}
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-ink/15 py-20 text-center">
          <Building2 className="mb-3 h-10 w-10 text-muted" />
          <p className="text-sm font-medium text-muted">{t('noListings')}</p>
          <p className="mt-1 text-xs text-muted">{t('noListingsHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing: Record<string, unknown>) => {
            const images = ((listing.listing_images as { storage_path: string; display_order: number }[] | undefined) ?? [])
              .sort((a, b) => a.display_order - b.display_order);
            const cover = images[0];
            const coBrokers = ((listing.listing_brokers as { role: string; user_profiles: { full_name: string } | null }[] | undefined) ?? [])
              .filter((b) => b.role === 'cooperating');
            const status = listing.status as Status;
            const showSharedBadge = status === 'active' || status === 'pending';

            return (
              <Link
                key={listing.id as string}
                href={`/${tenantId}/listings/${listing.id as string}`}
                className="group block overflow-hidden rounded-2xl bg-card ring-1 ring-ink/10 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-36 sm:h-40">
                  {cover ? (
                    <img src={buildImageUrl(cover.storage_path)} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-canvas">
                      <Building2 className="h-10 w-10 text-muted" />
                    </div>
                  )}
                  <div className="absolute start-3 top-3">
                    <StatusBadge status={status} label={t(`status.${status}`)} className="bg-white shadow-sm" />
                  </div>
                  {coBrokers.length > 0 && (
                    <div className="absolute end-3 top-3">
                      <AvatarStack
                        people={coBrokers.map((b) => ({ initials: initialsFromName(b.user_profiles?.full_name), tone: 'terracotta' as const }))}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {showSharedBadge && (
                    <Pill icon={<Link2 className="h-3 w-3" />} className="mb-2">
                      Shared with network
                    </Pill>
                  )}

                  <p className="font-heading text-lg font-bold text-ink">{formatAED(listing.price_aed as number)}</p>

                  <div className="mt-1.5 flex items-center gap-3 text-[13px] text-muted">
                    <span className="flex items-center gap-1">
                      <BedDouble className="h-3.5 w-3.5" />
                      {listing.bedrooms as number} {t('card.beds')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" />
                      {listing.bathrooms as number} {t('card.baths')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Maximize2 className="h-3.5 w-3.5" />
                      {(listing.size_sqft as number).toLocaleString()} {t('card.sqft')}
                    </span>
                  </div>

                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {listing.sub_community ? `${listing.sub_community}, ` : ''}{listing.area as string}
                  </p>

                  <p className="mt-2 text-xs text-muted">
                    {t('card.commission')}: {(listing.split_listing_pct as number) ?? commission.listing_pct}% / {(listing.split_cooperating_pct as number) ?? commission.cooperating_pct}%
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
