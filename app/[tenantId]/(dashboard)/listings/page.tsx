import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getListings, getCommissionConfig, type ListingFilters } from '@/app/actions/listings';
import { requireSignedAgreement } from '@/utils/requireAgreement';
import { buildImageUrl } from '@/utils/images';
import { Plus, BedDouble, Bath, Maximize2, Building2 } from 'lucide-react';
import ListingsFilterBar from './components/ListingsFilterBar';

export const dynamic = 'force-dynamic';

function formatAED(amount: number) {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
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

  const [listings, commission] = await Promise.all([
    getListings(tenantId, filters),
    getCommissionConfig(tenantId),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{t('title')}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
        </div>
        <Link
          href={`/${tenantId}/listings/new`}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('newListing')}
        </Link>
      </div>

      {/* Filters */}
      <ListingsFilterBar />

      {/* Listings grid */}
      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-20 text-center">
          <Building2 className="mb-3 h-10 w-10 text-zinc-300" />
          <p className="text-sm font-medium text-zinc-500">{t('noListings')}</p>
          <p className="mt-1 text-xs text-zinc-400">{t('noListingsHint')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing: Record<string, unknown>) => (
            <div
              key={listing.id as string}
              className="group rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/50 overflow-hidden hover:shadow-md hover:ring-zinc-300 transition-all"
            >
              {/* Cover image or gradient fallback */}
              {(() => {
                const images = ((listing.listing_images as { storage_path: string; display_order: number }[] | undefined) ?? [])
                  .sort((a, b) => a.display_order - b.display_order);
                const cover = images[0];
                return cover ? (
                  <img
                    src={buildImageUrl(cover.storage_path)}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-40 bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-brand-300" />
                  </div>
                );
              })()}

              <div className="p-5">
                {/* Status badge */}
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    listing.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                    listing.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                    listing.status === 'sold' ? 'bg-blue-50 text-blue-700' :
                    'bg-zinc-100 text-zinc-600'
                  }`}>
                    {t(`status.${listing.status as string}`)}
                  </span>
                  <span className="text-xs text-zinc-400">{t(`propertyTypes.${listing.property_type as string}`)}</span>
                </div>

                {/* Area */}
                <p className="text-sm font-semibold text-zinc-900">
                  {listing.area as string}
                  {!!listing.sub_community && (
                    <span className="font-normal text-zinc-500"> · {listing.sub_community as string}</span>
                  )}
                </p>

                {/* Price */}
                <p className="mt-1 text-xl font-bold text-brand-700">
                  {formatAED(listing.price_aed as number)}
                </p>

                {/* Stats */}
                <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
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

                {/* Commission */}
                <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                  {t('card.commission')}: {commission.listing_pct}% / {commission.cooperating_pct}%
                </div>

                <Link
                  href={`/${tenantId}/listings/${listing.id as string}`}
                  className="mt-4 block w-full rounded-xl border border-brand-200 py-2 text-center text-sm font-semibold text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  {t('card.viewDetails')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
