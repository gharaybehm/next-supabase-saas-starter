import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  adminClient: null as unknown,
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));

import { getMyStats, getPlatformStats } from './analytics';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

describe('getMyStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts active/total listings and computes commission earned for both broker roles', async () => {
    state.adminClient = createMockSupabase({
      listings: {
        data: [{ status: 'active' }, { status: 'active' }, { status: 'sold' }],
        error: null,
      },
      deals: {
        data: [
          // user is the listing broker: 2% of 1,000,000 * 50% = 10,000
          {
            listing_broker_id: 'user-1',
            cooperating_broker_id: 'user-2',
            listing_commission_pct: 50,
            cooperating_commission_pct: 50,
            listings: { price_aed: 1000000 },
          },
          // user is the cooperating broker: 2% of 2,000,000 * 30% = 12,000
          {
            listing_broker_id: 'user-2',
            cooperating_broker_id: 'user-1',
            listing_commission_pct: 70,
            cooperating_commission_pct: 30,
            listings: { price_aed: 2000000 },
          },
        ],
        error: null,
      },
    }).client;

    const result = await getMyStats('tenant-1', 'user-1');

    expect(result).toEqual({
      activeListings: 2,
      totalListings: 3,
      pendingListings: 0,
      dealsClosed: 2,
      commissionEarnedAed: 10000 + 12000,
      commissionThisMonthAed: 0,
    });
  });

  it('returns zeroed stats when there are no listings or deals', async () => {
    state.adminClient = createMockSupabase({
      listings: { data: [], error: null },
      deals: { data: [], error: null },
    }).client;

    const result = await getMyStats('tenant-1', 'user-1');

    expect(result).toEqual({
      activeListings: 0,
      totalListings: 0,
      pendingListings: 0,
      dealsClosed: 0,
      commissionEarnedAed: 0,
      commissionThisMonthAed: 0,
    });
  });
});

describe('getPlatformStats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('breaks down listings by status and ranks the top areas', async () => {
    state.adminClient = createMockSupabase({
      listings: {
        data: [
          { status: 'active', area: 'Downtown Dubai' },
          { status: 'active', area: 'Downtown Dubai' },
          { status: 'sold', area: 'Dubai Marina' },
          { status: 'pending', area: 'Downtown Dubai' },
          { status: 'expired', area: 'JVC' },
        ],
        error: null,
      },
      deals: { data: [], error: null },
    }).client;

    const result = await getPlatformStats('tenant-1');

    expect(result.listingsByStatus).toEqual({ active: 2, pending: 1, sold: 1, expired: 1 });
    expect(result.topAreas[0]).toEqual({ area: 'Downtown Dubai', listingCount: 3 });
  });

  it('computes total/this-month deal volume and ranks top brokers', async () => {
    state.adminClient = createMockSupabase({
      listings: { data: [], error: null },
      deals: {
        data: [
          // this month
          {
            listing_broker_id: 'broker-1',
            closed_at: '2026-06-10T00:00:00.000Z',
            lbu: { full_name: 'Jane Broker' },
            listings: { price_aed: 1000000 },
          },
          {
            listing_broker_id: 'broker-1',
            closed_at: '2026-06-12T00:00:00.000Z',
            lbu: { full_name: 'Jane Broker' },
            listings: { price_aed: 500000 },
          },
          // last month
          {
            listing_broker_id: 'broker-2',
            closed_at: '2026-05-20T00:00:00.000Z',
            lbu: null,
            listings: { price_aed: 2000000 },
          },
        ],
        error: null,
      },
    }).client;

    const result = await getPlatformStats('tenant-1');

    expect(result.totalDeals).toBe(3);
    expect(result.totalVolumeAed).toBe(3500000);
    expect(result.thisMonthDeals).toBe(2);
    expect(result.thisMonthVolumeAed).toBe(1500000);
    expect(result.topBrokers).toEqual(
      expect.arrayContaining([
        { full_name: 'Jane Broker', dealCount: 2 },
        { full_name: 'Unknown', dealCount: 1 },
      ])
    );
  });
});
