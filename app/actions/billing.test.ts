import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  serverClient: null as unknown,
  adminClient: null as unknown,
  customersCreate: vi.fn(),
  checkoutSessionsCreate: vi.fn(),
  billingPortalSessionsCreate: vi.fn(),
}));

vi.mock('@/utils/supabase/server', () => ({ createClient: async () => state.serverClient }));
vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('@/utils/stripe', () => ({
  getStripeClient: () => ({
    customers: { create: state.customersCreate },
    checkout: { sessions: { create: state.checkoutSessionsCreate } },
    billingPortal: { sessions: { create: state.billingPortalSessionsCreate } },
  }),
}));

import { createCheckoutSession, createBillingPortalSession } from './billing';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

function setAuth(role: string | null, authUser: { id: string; email?: string } | null = { id: 'user-1', email: 'admin@example.com' }) {
  const { client } = createMockSupabase(
    { tenant_members: { data: role ? { role } : null, error: null } },
    authUser
  );
  state.serverClient = client;
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_PRICE_ID', 'price_123');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    state.customersCreate.mockReset();
    state.checkoutSessionsCreate.mockReset();
    state.billingPortalSessionsCreate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an error when there is no authenticated user', async () => {
    setAuth(null, null);
    state.adminClient = createMockSupabase().client;

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ error: 'Not authenticated' });
    expect(state.customersCreate).not.toHaveBeenCalled();
    expect(state.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns an error when the user is not a tenant admin', async () => {
    setAuth('worker');
    state.adminClient = createMockSupabase().client;

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ error: 'Only the tenant administrator can manage billing.' });
    expect(state.customersCreate).not.toHaveBeenCalled();
    expect(state.checkoutSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns an error when STRIPE_PRICE_ID is not configured', async () => {
    vi.stubEnv('STRIPE_PRICE_ID', '');
    setAuth('admin');
    state.adminClient = createMockSupabase().client;

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ error: 'STRIPE_PRICE_ID not configured.' });
  });

  it('creates a new Stripe customer and upserts the subscription when none exists yet', async () => {
    setAuth('admin');
    const { client, calls } = createMockSupabase({
      subscriptions: { data: null, error: null },
    });
    state.adminClient = client;
    state.customersCreate.mockResolvedValue({ id: 'cus_new' });
    state.checkoutSessionsCreate.mockResolvedValue({ url: 'https://stripe.test/checkout/1' });

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ url: 'https://stripe.test/checkout/1' });
    expect(state.customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'admin@example.com', metadata: { tenant_id: 'tenant-1' } })
    );

    const upsert = calls.find((c) => c.table === 'subscriptions' && c.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({
      tenant_id: 'tenant-1',
      stripe_customer_id: 'cus_new',
      status: 'incomplete',
    });

    expect(state.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_new' })
    );
  });

  it('reuses an existing Stripe customer without creating a new one', async () => {
    setAuth('admin');
    const { client } = createMockSupabase({
      subscriptions: { data: { stripe_customer_id: 'cus_existing' }, error: null },
    });
    state.adminClient = client;
    state.checkoutSessionsCreate.mockResolvedValue({ url: 'https://stripe.test/checkout/2' });

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ url: 'https://stripe.test/checkout/2' });
    expect(state.customersCreate).not.toHaveBeenCalled();
    expect(state.checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });

  it('returns an error when the checkout session has no url', async () => {
    setAuth('admin');
    state.adminClient = createMockSupabase({
      subscriptions: { data: { stripe_customer_id: 'cus_existing' }, error: null },
    }).client;
    state.checkoutSessionsCreate.mockResolvedValue({ url: null });

    const result = await createCheckoutSession('tenant-1');

    expect(result).toEqual({ error: 'Failed to create checkout session.' });
  });
});

describe('createBillingPortalSession', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000');
    state.billingPortalSessionsCreate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an error when there is no authenticated user', async () => {
    setAuth(null, null);
    state.adminClient = createMockSupabase().client;

    const result = await createBillingPortalSession('tenant-1');

    expect(result).toEqual({ error: 'Not authenticated' });
    expect(state.billingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns an error when the user is not a tenant admin', async () => {
    setAuth('worker');
    state.adminClient = createMockSupabase().client;

    const result = await createBillingPortalSession('tenant-1');

    expect(result).toEqual({ error: 'Only the tenant administrator can manage billing.' });
    expect(state.billingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it('returns an error when there is no Stripe customer on file yet', async () => {
    setAuth('admin');
    state.adminClient = createMockSupabase({
      subscriptions: { data: null, error: null },
    }).client;

    const result = await createBillingPortalSession('tenant-1');

    expect(result).toEqual({ error: 'No billing account found for this tenant yet.' });
    expect(state.billingPortalSessionsCreate).not.toHaveBeenCalled();
  });

  it('creates a portal session for the tenant’s Stripe customer', async () => {
    setAuth('admin');
    state.adminClient = createMockSupabase({
      subscriptions: { data: { stripe_customer_id: 'cus_existing' }, error: null },
    }).client;
    state.billingPortalSessionsCreate.mockResolvedValue({ url: 'https://stripe.test/portal/1' });

    const result = await createBillingPortalSession('tenant-1');

    expect(result).toEqual({ url: 'https://stripe.test/portal/1' });
    expect(state.billingPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });
});
