import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  adminClient: null as unknown,
  validateApiKey: vi.fn(),
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('../middleware', () => ({ validateApiKey: state.validateApiKey }));

import { GET } from './route';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

function makeRequest(query = '') {
  return new NextRequest(`http://localhost/api/v1/trends${query}`, {
    headers: { Authorization: 'Bearer test_key' },
  });
}

describe('GET /api/v1/trends', () => {
  beforeEach(() => {
    state.validateApiKey.mockReset();
  });

  it('returns the error/status from validateApiKey when the API key is invalid', async () => {
    state.validateApiKey.mockResolvedValue({ error: 'Invalid API key.', status: 401 });
    state.adminClient = createMockSupabase().client;

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Invalid API key.' });
  });

  it('returns empty/zeroed aggregates for a tenant with no listings or deals', async () => {
    state.validateApiKey.mockResolvedValue({ ctx: { tenantId: 'tenant-1' } });
    state.adminClient = createMockSupabase({
      listings: { data: [], error: null },
      deals: { data: [], error: null },
    }).client;

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.trends).toEqual({
      avgPricePerArea: [],
      avgPricePerSqftByType: [],
      listingVolumeByType: [],
      avgDaysOnMarket: null,
      dealVolumeByMonth: [],
    });
  });

  it('computes correct aggregates from listings and deals', async () => {
    state.validateApiKey.mockResolvedValue({ ctx: { tenantId: 'tenant-1' } });
    state.adminClient = createMockSupabase({
      listings: {
        data: [
          { area: 'Downtown Dubai', property_type: 'apartment', price_aed: 1000000, size_sqft: 1000 },
          { area: 'Downtown Dubai', property_type: 'apartment', price_aed: 2000000, size_sqft: 1000 },
          { area: 'Dubai Marina', property_type: 'villa', price_aed: 3000000, size_sqft: 1500 },
        ],
        error: null,
      },
      deals: {
        data: [
          {
            closed_at: '2026-06-15T00:00:00.000Z',
            listings: { price_aed: 1500000, created_at: '2026-05-26T00:00:00.000Z' },
          },
          {
            closed_at: '2026-06-20T00:00:00.000Z',
            listings: { price_aed: 2500000, created_at: '2026-06-10T00:00:00.000Z' },
          },
        ],
        error: null,
      },
    }).client;

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);

    expect(body.trends.avgPricePerArea).toEqual(
      expect.arrayContaining([
        { area: 'Downtown Dubai', avgPriceAed: 1500000, listingCount: 2 },
        { area: 'Dubai Marina', avgPriceAed: 3000000, listingCount: 1 },
      ])
    );

    expect(body.trends.avgPricePerSqftByType).toEqual(
      expect.arrayContaining([
        { property_type: 'apartment', avgPricePerSqft: 1500 },
        { property_type: 'villa', avgPricePerSqft: 2000 },
      ])
    );

    expect(body.trends.listingVolumeByType).toEqual(
      expect.arrayContaining([
        { property_type: 'apartment', count: 2 },
        { property_type: 'villa', count: 1 },
      ])
    );

    // deal 1: 20 days on market, deal 2: 10 days on market -> average 15
    expect(body.trends.avgDaysOnMarket).toBe(15);

    expect(body.trends.dealVolumeByMonth).toEqual([
      { month: '2026-06', dealCount: 2, totalVolumeAed: 4000000 },
    ]);
  });

  it('returns a 500 with the DB error message when the listings query fails', async () => {
    state.validateApiKey.mockResolvedValue({ ctx: { tenantId: 'tenant-1' } });
    state.adminClient = createMockSupabase({
      listings: { data: null, error: { message: 'db unavailable' } },
      deals: { data: [], error: null },
    }).client;

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: 'db unavailable' });
  });
});
