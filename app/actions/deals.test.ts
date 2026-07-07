import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { closeDeal, getTenantMembers } from './deals';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

function dealFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    cooperating_broker_id: '',
    listing_commission_pct: '100',
    cooperating_commission_pct: '0',
    closed_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe('closeDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when the listing does not exist', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null }, listings: { data: null, error: null } },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await closeDeal('tenant-1', 'listing-1', dealFormData());

    expect(result).toEqual({ error: 'Listing not found.' });
  });

  it('rejects closing a listing that is not active', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'admin-1', status: 'sold', price_aed: 1000000 }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await closeDeal('tenant-1', 'listing-1', dealFormData());

    expect(result).toEqual({ error: 'Only active listings can be closed.' });
  });

  it('rejects a caller who is neither admin nor the listing broker', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'worker' }, error: null },
        listings: { data: { listing_broker_id: 'someone-else', status: 'active', price_aed: 1000000 }, error: null },
      },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await closeDeal('tenant-1', 'listing-1', dealFormData());

    expect(result).toEqual({ error: 'Not authorized to close this listing.' });
  });

  it('returns a validation error for malformed form data', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'admin-1', status: 'active', price_aed: 1000000 }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await closeDeal('tenant-1', 'listing-1', dealFormData({ closed_at: '' }));

    expect(result.error).toBeTruthy();
  });

  it('rejects when commission percentages with a cooperating broker do not sum to 100', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'admin-1', status: 'active', price_aed: 1000000 }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await closeDeal(
      'tenant-1',
      'listing-1',
      dealFormData({
        cooperating_broker_id: '11111111-1111-4111-8111-111111111111',
        listing_commission_pct: '60',
        cooperating_commission_pct: '60',
      })
    );

    expect(result).toEqual({ error: 'Commission percentages must sum to 100.' });
  });

  it('closes the deal, marks the listing sold, and writes an audit log (with a cooperating broker)', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'admin-1', status: 'active', price_aed: 1000000 }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls: adminCalls } = createMockSupabase({
      deals: { data: { id: 'deal-1' }, error: null },
    });
    state.adminClient = adminClient;

    const result = await closeDeal(
      'tenant-1',
      'listing-1',
      dealFormData({
        cooperating_broker_id: '11111111-1111-4111-8111-111111111111',
        listing_commission_pct: '50',
        cooperating_commission_pct: '50',
      })
    );

    expect(result).toEqual({ dealId: 'deal-1' });

    const insertDeal = adminCalls.find((c) => c.table === 'deals' && c.method === 'insert');
    expect(insertDeal?.args[0]).toMatchObject({
      tenant_id: 'tenant-1',
      listing_id: 'listing-1',
      listing_broker_id: 'admin-1',
      cooperating_broker_id: '11111111-1111-4111-8111-111111111111',
      listing_commission_pct: 50,
      cooperating_commission_pct: 50,
    });

    const auditLog = adminCalls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(auditLog?.args[0]).toMatchObject({
      action: 'deal_closed',
      target_id: 'listing-1',
      metadata: expect.objectContaining({ deal_id: 'deal-1', price_aed: 1000000 }),
    });
  });

  it('stores a null cooperating commission when there is no cooperating broker', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'admin-1', status: 'active', price_aed: 1000000 }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls: adminCalls } = createMockSupabase({
      deals: { data: { id: 'deal-2' }, error: null },
    });
    state.adminClient = adminClient;

    const result = await closeDeal('tenant-1', 'listing-1', dealFormData());

    expect(result).toEqual({ dealId: 'deal-2' });
    const insertDeal = adminCalls.find((c) => c.table === 'deals' && c.method === 'insert');
    expect(insertDeal?.args[0]).toMatchObject({
      cooperating_broker_id: null,
      cooperating_commission_pct: null,
    });
  });
});

describe('getTenantMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps member fields and applies defaults for missing nested profiles', async () => {
    state.adminClient = createMockSupabase({
      tenant_members: {
        data: [
          {
            user_id: 'broker-1',
            user_profiles: { full_name: 'Jane Broker' },
            broker_profiles: { rera_card_no: 'RERA-1', brokerage_name: 'Acme Realty' },
          },
          { user_id: 'broker-2', user_profiles: null, broker_profiles: null },
        ],
        error: null,
      },
    }).client;

    const result = await getTenantMembers('tenant-1');

    expect(result).toEqual([
      { user_id: 'broker-1', full_name: 'Jane Broker', rera_card_no: 'RERA-1', brokerage_name: 'Acme Realty' },
      { user_id: 'broker-2', full_name: 'Unknown', rera_card_no: '', brokerage_name: '' },
    ]);
  });

  it('returns an empty array on error', async () => {
    state.adminClient = createMockSupabase({
      tenant_members: { data: null, error: { message: 'boom' } },
    }).client;

    const result = await getTenantMembers('tenant-1');

    expect(result).toEqual([]);
  });
});
