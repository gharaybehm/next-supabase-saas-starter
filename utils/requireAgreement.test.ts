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

import { requireSignedAgreement } from './requireAgreement';
import { createMockSupabase } from './__tests__/supabaseMock';

describe('requireSignedAgreement', () => {
  beforeEach(() => {
    state.redirect.mockClear();
  });

  it('redirects to /login when there is no authenticated user', async () => {
    const { client } = createMockSupabase({}, null);
    state.serverClient = client;
    state.adminClient = createMockSupabase({}).client;

    await expect(requireSignedAgreement('tenant-1')).rejects.toThrow('REDIRECT:/login');
  });

  it('exempts tenant admins regardless of agreement status', async () => {
    const { client: serverClient } = createMockSupabase(
      { tenant_members: { data: { role: 'admin' }, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = serverClient;
    state.adminClient = createMockSupabase({ agreements: { data: null, error: null } }).client;

    await expect(requireSignedAgreement('tenant-1')).resolves.toBeUndefined();
  });

  it('redirects to verifying-credentials when DLD is not yet verified', async () => {
    const { client: serverClient } = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = serverClient;
    state.adminClient = createMockSupabase({
      broker_profiles: { data: { dld_verified: false }, error: null },
    }).client;

    await expect(requireSignedAgreement('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/verifying-credentials');
  });

  it('allows access when DLD is verified and the agreement is signed', async () => {
    const { client: serverClient } = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = serverClient;
    state.adminClient = createMockSupabase({
      broker_profiles: { data: { dld_verified: true }, error: null },
      agreements: { data: { status: 'signed' }, error: null },
    }).client;

    await expect(requireSignedAgreement('tenant-1')).resolves.toBeUndefined();
  });

  it.each(['pending', 'sent', 'viewed', 'declined'])(
    'redirects to pending-agreement when DLD is verified and status is %s',
    async (status) => {
      const { client: serverClient } = createMockSupabase(
        { tenant_members: { data: { role: 'worker' }, error: null } },
        { id: 'user-1' }
      );
      state.serverClient = serverClient;
      state.adminClient = createMockSupabase({
        broker_profiles: { data: { dld_verified: true }, error: null },
        agreements: { data: { status }, error: null },
      }).client;

      await expect(requireSignedAgreement('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/pending-agreement');
    }
  );

  it('redirects to pending-agreement when DLD is verified but no agreement row exists', async () => {
    const { client: serverClient } = createMockSupabase(
      { tenant_members: { data: { role: 'worker' }, error: null } },
      { id: 'user-1' }
    );
    state.serverClient = serverClient;
    state.adminClient = createMockSupabase({
      broker_profiles: { data: { dld_verified: true }, error: null },
      agreements: { data: null, error: null },
    }).client;

    await expect(requireSignedAgreement('tenant-1')).rejects.toThrow('REDIRECT:/tenant-1/pending-agreement');
  });
});
