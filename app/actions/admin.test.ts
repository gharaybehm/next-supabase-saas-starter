import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { verifyBroker, updateCommission, generateApiKey, revokeApiKey } from './admin';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

describe('requireAdmin gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyBroker rejects when there is no authenticated user', async () => {
    state.serverClient = createMockSupabase({}, null).client;
    state.adminClient = createMockSupabase().client;

    const result = await verifyBroker('tenant-1', 'broker-1', true);

    expect(result).toEqual({ error: 'Not authenticated' });
  });

  it('verifyBroker rejects a non-admin caller', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await verifyBroker('tenant-1', 'broker-1', true);

    expect(result).toEqual({ error: 'Not authorized' });
  });

  it('updateCommission rejects a non-admin caller', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await updateCommission('tenant-1', 50, 50);

    expect(result).toEqual({ error: 'Not authorized' });
  });
});

describe('verifyBroker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets dld_verified and logs broker_dld_verified', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase();
    state.adminClient = adminClient;

    const result = await verifyBroker('tenant-1', 'broker-1', true);

    expect(result).toEqual({});
    const update = calls.find((c) => c.table === 'broker_profiles' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ dld_verified: true });
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'broker_dld_verified', target_id: 'broker-1' });
  });

  it('logs broker_dld_unverified when un-verifying', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase();
    state.adminClient = adminClient;

    await verifyBroker('tenant-1', 'broker-1', false);

    const update = calls.find((c) => c.table === 'broker_profiles' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ dld_verified: false });
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'broker_dld_unverified' });
  });
});

describe('updateCommission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects percentages that do not sum to 100 without even checking admin status', async () => {
    const result = await updateCommission('tenant-1', 40, 40);

    expect(result).toEqual({ error: 'Commission percentages must total 100%.' });
  });

  it('upserts the commission config and writes an audit log', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase();
    state.adminClient = adminClient;

    const result = await updateCommission('tenant-1', 60, 40);

    expect(result).toEqual({});
    const upsert = calls.find((c) => c.table === 'commission_config' && c.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({ tenant_id: 'tenant-1', listing_pct: 60, cooperating_pct: 40 });
    const audit = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({
      action: 'commission_updated',
      metadata: { listing_pct: 60, cooperating_pct: 40 },
    });
  });
});

describe('generateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a raw mmls_-prefixed key and stores only its sha256 hash', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase({
      api_keys: { data: null, error: null },
    });
    state.adminClient = adminClient;

    const result = await generateApiKey('tenant-1', 'CRM integration');

    expect(result.key).toMatch(/^mmls_[0-9a-f]+$/);
    const insert = calls.find((c) => c.table === 'api_keys' && c.method === 'insert');
    const expectedHash = createHash('sha256').update(result.key!).digest('hex');
    expect((insert?.args[0] as { key_hash: string }).key_hash).toBe(expectedHash);
    expect(insert?.args[0]).not.toHaveProperty('key');
  });

  it('returns an error when the insert fails', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    state.adminClient = createMockSupabase({
      api_keys: { data: null, error: { message: 'duplicate key' } },
    }).client;

    const result = await generateApiKey('tenant-1', 'CRM integration');

    expect(result).toEqual({ error: 'duplicate key' });
  });
});

describe('revokeApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets revoked_at scoped to the key id and tenant', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase();
    state.adminClient = adminClient;

    const result = await revokeApiKey('tenant-1', 'key-1');

    expect(result).toEqual({});
    const update = calls.find((c) => c.table === 'api_keys' && c.method === 'update');
    expect(update?.args[0]).toHaveProperty('revoked_at');
    const eqCalls = calls.filter((c) => c.table === 'api_keys' && c.method === 'eq').map((c) => c.args);
    expect(eqCalls).toContainEqual(['id', 'key-1']);
    expect(eqCalls).toContainEqual(['tenant_id', 'tenant-1']);
  });
});
