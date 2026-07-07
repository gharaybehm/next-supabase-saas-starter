'use server';

import { createAdminClient } from '@/utils/supabase/admin';

export interface MyStats {
  activeListings: number;
  totalListings: number;
  pendingListings: number;
  dealsClosed: number;
  commissionEarnedAed: number;
  commissionThisMonthAed: number;
}

export interface StatusCounts {
  active: number;
  pending: number;
  sold: number;
  expired: number;
}

export interface BrokerStat {
  full_name: string;
  dealCount: number;
}

export interface AreaStat {
  area: string;
  listingCount: number;
}

export interface PlatformStats {
  listingsByStatus: StatusCounts;
  totalDeals: number;
  totalVolumeAed: number;
  thisMonthDeals: number;
  thisMonthVolumeAed: number;
  topBrokers: BrokerStat[];
  topAreas: AreaStat[];
}

export async function getMyStats(tenantId: string, userId: string): Promise<MyStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const [{ data: myListings }, { data: myDeals }] = await Promise.all([
    admin
      .from('listings')
      .select('status')
      .eq('tenant_id', tenantId)
      .eq('listing_broker_id', userId),

    admin
      .from('deals')
      .select('listing_broker_id, cooperating_broker_id, listing_commission_pct, cooperating_commission_pct, closed_at, listings!deals_listing_id_fkey(price_aed)')
      .eq('tenant_id', tenantId)
      .or(`listing_broker_id.eq.${userId},cooperating_broker_id.eq.${userId}`),
  ]);

  const activeListings = (myListings ?? []).filter((l: { status: string }) => l.status === 'active').length;
  const pendingListings = (myListings ?? []).filter((l: { status: string }) => l.status === 'pending').length;
  const totalListings = (myListings ?? []).length;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let commissionEarnedAed = 0;
  let commissionThisMonthAed = 0;
  for (const deal of myDeals ?? []) {
    const priceAed: number = deal.listings?.price_aed ?? 0;
    const totalCommission = priceAed * 0.02;
    const share = deal.listing_broker_id === userId
      ? totalCommission * (deal.listing_commission_pct / 100)
      : totalCommission * ((deal.cooperating_commission_pct ?? 0) / 100);
    commissionEarnedAed += share;
    if (deal.closed_at >= startOfMonth) commissionThisMonthAed += share;
  }

  return {
    activeListings,
    totalListings,
    pendingListings,
    dealsClosed: (myDeals ?? []).length,
    commissionEarnedAed,
    commissionThisMonthAed,
  };
}

export async function getPlatformStats(tenantId: string): Promise<PlatformStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [{ data: allListings }, { data: allDeals }] = await Promise.all([
    admin.from('listings').select('status, area').eq('tenant_id', tenantId),
    admin
      .from('deals')
      .select('listing_broker_id, listing_commission_pct, cooperating_commission_pct, closed_at, lbu:user_profiles!deals_listing_broker_id_fkey(full_name), listings!deals_listing_id_fkey(price_aed)')
      .eq('tenant_id', tenantId),
  ]);

  // Listing status breakdown
  const listingsByStatus: StatusCounts = { active: 0, pending: 0, sold: 0, expired: 0 };
  for (const l of allListings ?? []) {
    if (l.status in listingsByStatus) listingsByStatus[l.status as keyof StatusCounts]++;
  }

  // Area breakdown
  const areaCounts: Record<string, number> = {};
  for (const l of allListings ?? []) {
    areaCounts[l.area] = (areaCounts[l.area] ?? 0) + 1;
  }
  const topAreas: AreaStat[] = Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, listingCount]) => ({ area, listingCount }));

  // Deal aggregations
  let totalVolumeAed = 0;
  let thisMonthDeals = 0;
  let thisMonthVolumeAed = 0;
  const brokerCounts: Record<string, { name: string; count: number }> = {};

  for (const deal of allDeals ?? []) {
    const priceAed: number = deal.listings?.price_aed ?? 0;
    totalVolumeAed += priceAed;
    if (deal.closed_at >= startOfMonth) {
      thisMonthDeals++;
      thisMonthVolumeAed += priceAed;
    }
    const brokerId: string = deal.listing_broker_id;
    if (!brokerCounts[brokerId]) {
      brokerCounts[brokerId] = { name: deal.lbu?.full_name ?? 'Unknown', count: 0 };
    }
    brokerCounts[brokerId].count++;
  }

  const topBrokers: BrokerStat[] = Object.values(brokerCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ name, count }) => ({ full_name: name, dealCount: count }));

  return {
    listingsByStatus,
    totalDeals: (allDeals ?? []).length,
    totalVolumeAed,
    thisMonthDeals,
    thisMonthVolumeAed,
    topBrokers,
    topAreas,
  };
}
