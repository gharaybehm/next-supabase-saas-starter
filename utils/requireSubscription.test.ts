import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('next/navigation', () => ({ redirect: state.redirect }));
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));

import { requireActiveSubscription } from './requireSubscription';
import { createMockSupabase } from './__tests__/supabaseMock';

describe('requireActiveSubscription', () => {
  beforeEach(() => {
    state.redirect.mockClear();
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    ).client;
  });

  it('redirects non-admins to billing-blocked when no subscription row exists', async () => {
    const { client } = createMockSupabase({ subscriptions: { data: null, error: null } });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/billing-blocked');
  });

  it('allows access when status is active', async () => {
    const { client } = createMockSupabase({
      subscriptions: { data: { status: 'active', grace_period_ends_at: null }, error: null },
    });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).resolves.toBeUndefined();
  });

  it('allows access when past_due but still within the grace period', async () => {
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { client } = createMockSupabase({
      subscriptions: { data: { status: 'past_due', grace_period_ends_at: future }, error: null },
    });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).resolves.toBeUndefined();
  });

  it('redirects non-admins when past_due and the grace period has expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const { client } = createMockSupabase({
      subscriptions: { data: { status: 'past_due', grace_period_ends_at: past }, error: null },
    });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/billing-blocked');
  });

  it.each(['canceled', 'unpaid', 'incomplete'])('redirects non-admins when status is %s', async (status) => {
    const { client } = createMockSupabase({
      subscriptions: { data: { status, grace_period_ends_at: null }, error: null },
    });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/billing-blocked');
  });

  it('redirects admins to billing (not billing-blocked) when blocked', async () => {
    state.serverClient = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'user-1' }
    ).client;
    const { client } = createMockSupabase({ subscriptions: { data: null, error: null } });
    state.adminClient = client;

    await expect(requireActiveSubscription('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/billing');
  });
});
