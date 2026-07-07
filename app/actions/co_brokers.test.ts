import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { addCoBroker, removeCoBroker } from './co_brokers';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

describe('addCoBroker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when the listing does not exist', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null }, listings: { data: null, error: null } },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Listing not found.' });
  });

  it('rejects a caller who is neither admin nor the listing owner', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'worker' }, error: null },
        listings: { data: { listing_broker_id: 'someone-else' }, error: null },
      },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Not authorized.' });
  });

  it('rejects when the listing already has 3 brokers', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({
      listing_brokers: { data: null, error: null, count: 3 },
    }).client;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Maximum 3 brokers per DLD listing.' });
  });

  it('rejects when the target broker is not a member of the tenant', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({
      listing_brokers: { data: null, error: null, count: 1 },
      tenant_members: { data: null, error: null },
    }).client;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Broker is not a member of this community.' });
  });

  it('maps a Postgres unique-violation into a friendly duplicate error', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({
      listing_brokers: { data: null, error: { code: '23505' }, count: 1 },
      tenant_members: { data: { user_id: 'broker-2' }, error: null },
    }).client;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'This broker is already on this listing.' });
  });

  it('adds the co-broker and writes an audit log on success', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase({
      listing_brokers: { data: null, error: null, count: 1 },
      tenant_members: { data: { user_id: 'broker-2' }, error: null },
    });
    state.adminClient = adminClient;

    const result = await addCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({});
    const insert = calls.find((c) => c.table === 'listing_brokers' && c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ listing_id: 'listing-1', broker_id: 'broker-2', role: 'co-listing' });
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'co_broker_added', target_id: 'listing-1' });
  });
});

describe('removeCoBroker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an error when the listing does not exist', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null }, listings: { data: null, error: null } },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await removeCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Listing not found.' });
  });

  it('rejects a caller who is neither admin nor the listing owner', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'worker' }, error: null },
        listings: { data: { listing_broker_id: 'someone-else' }, error: null },
      },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await removeCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Not authorized.' });
  });

  it('returns an error when the broker is not on the listing', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({ listing_brokers: { data: null, error: null } }).client;

    const result = await removeCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({ error: 'Broker not found on this listing.' });
  });

  it('refuses to remove the primary listing broker', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({ listing_brokers: { data: { role: 'listing' }, error: null } }).client;

    const result = await removeCoBroker('tenant-1', 'listing-1', 'owner-1');

    expect(result).toEqual({ error: 'Cannot remove the primary listing broker.' });
  });

  it('removes a co-listing broker and writes an audit log', async () => {
    state.serverClient = createMockSupabase(
      {
        tenant_members: { data: { role: 'admin' }, error: null },
        listings: { data: { listing_broker_id: 'owner-1' }, error: null },
      },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase({
      listing_brokers: { data: { role: 'co-listing' }, error: null },
    });
    state.adminClient = adminClient;

    const result = await removeCoBroker('tenant-1', 'listing-1', 'broker-2');

    expect(result).toEqual({});
    const del = calls.find((c) => c.table === 'listing_brokers' && c.method === 'delete');
    expect(del).toBeDefined();
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'co_broker_removed', target_id: 'listing-1' });
  });
});
