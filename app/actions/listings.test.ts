import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createListing, updateListingStatus, getListings, getCommissionConfig } from './listings';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

function validListingFormData(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    area: 'Downtown Dubai',
    property_type: 'apartment',
    price_aed: '1500000',
    size_sqft: '900',
    bedrooms: '2',
    bathrooms: '2',
    dld_permit_no: 'DLD-12345',
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe('createListing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when required fields fail validation', async () => {
    const { client, calls } = createMockSupabase({}, { id: 'user-1' });
    state.serverClient = client;

    const fd = validListingFormData();
    fd.delete('area');

    const result = await createListing('tenant-1', fd);

    expect(result.error).toBeTruthy();
    expect(calls.find((c) => c.table === 'listings' && c.method === 'insert')).toBeUndefined();
  });

  it('rejects when the broker has not signed the co-brokerage agreement', async () => {
    const { client, calls } = createMockSupabase(
      { agreements: { data: { status: 'pending' }, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = client;

    const result = await createListing('tenant-1', validListingFormData());

    expect(result).toEqual({ error: 'You must sign the Co-Brokerage Agreement before listing properties.' });
    expect(calls.find((c) => c.table === 'listings' && c.method === 'insert')).toBeUndefined();
  });

  it('creates the listing, adds the listing broker, and writes an audit log when the agreement is signed', async () => {
    const { client, calls } = createMockSupabase(
      {
        agreements: { data: { status: 'signed' }, error: null },
        listings: { data: { id: 'listing-1' }, error: null },
      },
      { id: 'user-1' }
    );
    state.serverClient = client;

    const result = await createListing('tenant-1', validListingFormData());

    expect(result).toEqual({ listingId: 'listing-1' });

    const insertListing = calls.find((c) => c.table === 'listings' && c.method === 'insert');
    expect(insertListing?.args[0]).toMatchObject({
      tenant_id: 'tenant-1',
      listing_broker_id: 'user-1',
      area: 'Downtown Dubai',
      property_type: 'apartment',
    });

    const insertBroker = calls.find((c) => c.table === 'listing_brokers' && c.method === 'insert');
    expect(insertBroker?.args[0]).toMatchObject({ listing_id: 'listing-1', broker_id: 'user-1', role: 'listing' });

    const insertAudit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(insertAudit?.args[0]).toMatchObject({ tenant_id: 'tenant-1', action: 'listing_created', target_id: 'listing-1' });
  });
});

describe('updateListingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when the listing does not exist', async () => {
    const { client } = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null }, listings: { data: null, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = client;

    const result = await updateListingStatus('tenant-1', 'listing-1', 'sold');

    expect(result).toEqual({ error: 'Listing not found.' });
  });

  it('rejects a non-admin who does not own the listing', async () => {
    const { client, calls } = createMockSupabase(
      {
        tenant_members: { data: { role: 'worker' }, error: null },
        listings: { data: { listing_broker_id: 'someone-else' }, error: null },
      },
      { id: 'user-1' }
    );
    state.serverClient = client;

    const result = await updateListingStatus('tenant-1', 'listing-1', 'sold');

    expect(result).toEqual({ error: 'Not authorized to update this listing.' });
    expect(calls.find((c) => c.table === 'listings' && c.method === 'update')).toBeUndefined();
  });

  it('allows an admin to update any listing', async () => {
    const { client, calls } = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'someone-else' }, error: null },
      },
      { id: 'admin-1' }
    );
    state.serverClient = client;

    const result = await updateListingStatus('tenant-1', 'listing-1', 'sold');

    expect(result).toEqual({});
    const update = calls.find((c) => c.table === 'listings' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ status: 'sold' });
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'listing_status_changed', target_id: 'listing-1', metadata: { new_status: 'sold' } });
  });

  it('allows the listing owner to update their own listing', async () => {
    const { client, calls } = createMockSupabase(
      {
        tenant_members: { data: { role: 'worker' }, error: null },
        listings: { data: { listing_broker_id: 'user-1' }, error: null },
      },
      { id: 'user-1' }
    );
    state.serverClient = client;

    const result = await updateListingStatus('tenant-1', 'listing-1', 'pending');

    expect(result).toEqual({});
    const update = calls.find((c) => c.table === 'listings' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ status: 'pending' });
  });
});

describe('getListings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to sorting by newest when no sort filter is given', async () => {
    const { client, calls } = createMockSupabase({ listings: { data: [], error: null } });
    state.serverClient = client;

    await getListings('tenant-1', {});

    const order = calls.find((c) => c.table === 'listings' && c.method === 'order');
    expect(order?.args).toEqual(['created_at', { ascending: false }]);
  });

  it.each([
    ['oldest', 'created_at', true],
    ['price_asc', 'price_aed', true],
    ['price_desc', 'price_aed', false],
    ['size_asc', 'size_sqft', true],
    ['size_desc', 'size_sqft', false],
  ])('maps sort=%s to column %s ascending=%s', async (sort, column, ascending) => {
    const { client, calls } = createMockSupabase({ listings: { data: [], error: null } });
    state.serverClient = client;

    await getListings('tenant-1', { sort });

    const order = calls.find((c) => c.table === 'listings' && c.method === 'order');
    expect(order?.args).toEqual([column, { ascending }]);
  });

  it('applies only the filters that are provided', async () => {
    const { client, calls } = createMockSupabase({ listings: { data: [], error: null } });
    state.serverClient = client;

    await getListings('tenant-1', { area: 'Marina', price_min: 500000, bedrooms_min: 0 });

    expect(calls.find((c) => c.table === 'listings' && c.method === 'ilike')?.args).toEqual(['area', '%Marina%']);
    expect(calls.find((c) => c.table === 'listings' && c.method === 'gte' && c.args[0] === 'price_aed')?.args).toEqual([
      'price_aed',
      500000,
    ]);
    // bedrooms_min: 0 is falsy-but-defined — the code checks `!== undefined`, so it must still apply
    expect(calls.find((c) => c.table === 'listings' && c.method === 'gte' && c.args[0] === 'bedrooms')?.args).toEqual([
      'bedrooms',
      0,
    ]);
    expect(calls.find((c) => c.table === 'listings' && c.method === 'eq' && c.args[0] === 'property_type')).toBeUndefined();
  });

  it('returns an empty array when the query errors', async () => {
    const { client } = createMockSupabase({ listings: { data: null, error: { message: 'boom' } } });
    state.serverClient = client;

    const result = await getListings('tenant-1', {});

    expect(result).toEqual([]);
  });
});

describe('getCommissionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the configured percentages when a row exists', async () => {
    const { client } = createMockSupabase({
      commission_config: { data: { listing_pct: 60, cooperating_pct: 40 }, error: null },
    });
    state.serverClient = client;

    const result = await getCommissionConfig('tenant-1');

    expect(result).toEqual({ listing_pct: 60, cooperating_pct: 40 });
  });

  it('falls back to a 50/50 split when no row exists', async () => {
    const { client } = createMockSupabase({ commission_config: { data: null, error: null } });
    state.serverClient = client;

    const result = await getCommissionConfig('tenant-1');

    expect(result).toEqual({ listing_pct: 50, cooperating_pct: 50 });
  });
});
