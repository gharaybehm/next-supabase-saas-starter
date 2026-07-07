import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '../middleware';
import { createAdminClient } from '@/utils/supabase/admin';

interface ListingRow {
  area: string | null;
  property_type: string | null;
  price_aed: number;
  size_sqft: number | null;
}

interface DealRow {
  closed_at: string;
  listings: { price_aed: number; created_at: string } | null;
}

export async function GET(req: NextRequest) {
  const { ctx, error, status } = await validateApiKey(req);
  if (error || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const sp = req.nextUrl.searchParams;
  const area = sp.get('area');
  const propertyType = sp.get('property_type');
  const months = Math.max(1, Number(sp.get('months')) || 12);

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  let listingsQuery = db
    .from('listings')
    .select('area, property_type, price_aed, size_sqft')
    .eq('tenant_id', ctx.tenantId);
  if (area) listingsQuery = listingsQuery.ilike('area', `%${area}%`);
  if (propertyType) listingsQuery = listingsQuery.eq('property_type', propertyType);

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - months);

  const [{ data: listings, error: listingsError }, { data: deals, error: dealsError }] = await Promise.all([
    listingsQuery,
    db
      .from('deals')
      .select('closed_at, listings!deals_listing_id_fkey(price_aed, created_at)')
      .eq('tenant_id', ctx.tenantId)
      .gte('closed_at', sinceDate.toISOString()),
  ]);

  if (listingsError || dealsError) {
    return NextResponse.json({ error: (listingsError ?? dealsError)?.message }, { status: 500 });
  }

  const listingRows: ListingRow[] = listings ?? [];
  const dealRows: DealRow[] = deals ?? [];

  // Average price + listing count per area
  const areaAgg: Record<string, { total: number; count: number }> = {};
  for (const l of listingRows) {
    if (!l.area) continue;
    areaAgg[l.area] ??= { total: 0, count: 0 };
    areaAgg[l.area].total += l.price_aed;
    areaAgg[l.area].count += 1;
  }
  const avgPricePerArea = Object.entries(areaAgg)
    .map(([areaName, { total, count }]) => ({
      area: areaName,
      avgPriceAed: Math.round(total / count),
      listingCount: count,
    }))
    .sort((a, b) => b.listingCount - a.listingCount);

  // Average price per sqft + listing volume, grouped by property type
  const typePriceAgg: Record<string, { totalPricePerSqft: number; count: number }> = {};
  const typeCounts: Record<string, number> = {};
  for (const l of listingRows) {
    if (!l.property_type) continue;
    typeCounts[l.property_type] = (typeCounts[l.property_type] ?? 0) + 1;
    if (l.size_sqft && l.size_sqft > 0) {
      typePriceAgg[l.property_type] ??= { totalPricePerSqft: 0, count: 0 };
      typePriceAgg[l.property_type].totalPricePerSqft += l.price_aed / l.size_sqft;
      typePriceAgg[l.property_type].count += 1;
    }
  }
  const avgPricePerSqftByType = Object.entries(typePriceAgg).map(([type, { totalPricePerSqft, count }]) => ({
    property_type: type,
    avgPricePerSqft: Math.round(totalPricePerSqft / count),
  }));
  const listingVolumeByType = Object.entries(typeCounts).map(([type, count]) => ({
    property_type: type,
    count,
  }));

  // Days on market + deal volume by month, from closed deals
  let totalDaysOnMarket = 0;
  let daysOnMarketCount = 0;
  const monthAgg: Record<string, { dealCount: number; totalVolumeAed: number }> = {};

  for (const d of dealRows) {
    const priceAed = d.listings?.price_aed ?? 0;
    const month = d.closed_at.slice(0, 7); // YYYY-MM
    monthAgg[month] ??= { dealCount: 0, totalVolumeAed: 0 };
    monthAgg[month].dealCount += 1;
    monthAgg[month].totalVolumeAed += priceAed;

    if (d.listings?.created_at) {
      const days =
        (new Date(d.closed_at).getTime() - new Date(d.listings.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (days >= 0) {
        totalDaysOnMarket += days;
        daysOnMarketCount += 1;
      }
    }
  }

  const dealVolumeByMonth = Object.entries(monthAgg)
    .map(([month, { dealCount, totalVolumeAed }]) => ({ month, dealCount, totalVolumeAed }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const avgDaysOnMarket = daysOnMarketCount > 0 ? Math.round(totalDaysOnMarket / daysOnMarketCount) : null;

  return NextResponse.json({
    trends: {
      avgPricePerArea,
      avgPricePerSqftByType,
      listingVolumeByType,
      avgDaysOnMarket,
      dealVolumeByMonth,
    },
  });
}
