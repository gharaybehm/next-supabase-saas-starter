import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const state = vi.hoisted(() => ({
  adminClient: null as unknown,
  constructEvent: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
}));

vi.mock('@/utils/supabase/admin', () => ({ createAdminClient: () => state.adminClient }));
vi.mock('@/utils/stripe', () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: state.constructEvent },
    subscriptions: { retrieve: state.subscriptionsRetrieve },
  }),
  GRACE_PERIOD_DAYS: 7,
}));

import { POST } from './route';
import { createMockSupabase } from '@/utils/__tests__/supabaseMock';

function makeRequest() {
  return new NextRequest('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    body: '{}',
    headers: { 'stripe-signature': 'sig_test' },
  });
}

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    state.constructEvent.mockReset();
    state.subscriptionsRetrieve.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when the signature is invalid', async () => {
    state.constructEvent.mockImplementation(() => {
      throw new Error('bad signature');
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    expect(calls.length).toBe(0);
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
  });

  it('activates the subscription on checkout.session.completed', async () => {
    state.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenant_id: 'tenant-1' },
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);

    const update = calls.find((c) => c.table === 'subscriptions' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({
      status: 'active',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      grace_period_ends_at: null,
    });

    const insert = calls.find((c) => c.table === 'audit_logs' && c.method === 'insert');
    expect(insert?.args[0]).toMatchObject({ tenant_id: 'tenant-1', action: 'subscription_activated' });
  });

  it.each([
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['unpaid', 'unpaid'],
  ])('maps Stripe subscription status %s to %s', async (stripeStatus, expected) => {
    state.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          status: stripeStatus,
          metadata: { tenant_id: 'tenant-1' },
          items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 1000 }] },
        },
      },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const update = calls.find((c) => c.table === 'subscriptions' && c.method === 'update');
    expect((update?.args[0] as { status: string }).status).toBe(expected);
  });

  it('clears the grace period when a subscription becomes active again', async () => {
    state.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1',
          status: 'active',
          metadata: { tenant_id: 'tenant-1' },
          items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 1000 }] },
        },
      },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    await POST(makeRequest());

    const update = calls.find((c) => c.table === 'subscriptions' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ status: 'active', grace_period_ends_at: null });
  });

  it('starts a 7-day grace period on invoice.payment_failed', async () => {
    state.constructEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_1' } },
    });
    state.subscriptionsRetrieve.mockResolvedValue({ id: 'sub_1', metadata: { tenant_id: 'tenant-1' } });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const before = Date.now();
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const update = calls.find((c) => c.table === 'subscriptions' && c.method === 'update');
    const payload = update?.args[0] as { status: string; grace_period_ends_at: string };
    expect(payload.status).toBe('past_due');

    const graceMs = new Date(payload.grace_period_ends_at).getTime() - before;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(graceMs).toBeGreaterThan(sevenDaysMs - 5000);
    expect(graceMs).toBeLessThan(sevenDaysMs + 5000);
  });

  it('cancels the subscription on customer.subscription.deleted', async () => {
    state.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', metadata: { tenant_id: 'tenant-1' } } },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const update = calls.find((c) => c.table === 'subscriptions' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ status: 'canceled', grace_period_ends_at: null });
  });

  it('does nothing when tenant_id metadata is missing', async () => {
    state.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: { object: { metadata: {}, customer: 'cus_1', subscription: 'sub_1' } },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(calls.length).toBe(0);
  });

  it('returns 200 for unhandled event types without touching the database', async () => {
    state.constructEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: { object: {} },
    });
    const { client, calls } = createMockSupabase();
    state.adminClient = client;

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(calls.length).toBe(0);
  });
});
