import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { generateApiKey, revokeApiKey, removeMember } from './admin';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

describe('requireAdmin gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when there is no authenticated user', async () => {
    state.serverClient = createMockSupabase({}, null).client;
    state.adminClient = createMockSupabase().client;

    const result = await generateApiKey('tenant-1', 'CRM integration');

    expect(result).toEqual({ error: 'Not authenticated' });
  });

  it('rejects a non-admin caller', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    ).client;
    state.adminClient = createMockSupabase().client;

    const result = await generateApiKey('tenant-1', 'CRM integration');

    expect(result).toEqual({ error: 'Not authorized' });
  });
});

describe('generateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a raw sk_-prefixed key and stores only its sha256 hash', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase({
      api_keys: { data: null, error: null },
    });
    state.adminClient = adminClient;

    const result = await generateApiKey('tenant-1', 'CRM integration');

    expect(result.key).toMatch(/^sk_[0-9a-f]+$/);
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

describe('removeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the tenant_members row scoped to tenant and user', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'admin-1' }
    ).client;
    const { client: adminClient, calls } = createMockSupabase();
    state.adminClient = adminClient;

    const result = await removeMember('tenant-1', 'member-1');

    expect(result).toEqual({});
    const del = calls.find((c) => c.table === 'tenant_members' && c.method === 'delete');
    expect(del).toBeTruthy();
    const eqCalls = calls.filter((c) => c.table === 'tenant_members' && c.method === 'eq').map((c) => c.args);
    expect(eqCalls).toContainEqual(['tenant_id', 'tenant-1']);
    expect(eqCalls).toContainEqual(['user_id', 'member-1']);
  });
});
