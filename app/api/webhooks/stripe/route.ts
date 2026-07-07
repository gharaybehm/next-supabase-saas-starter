import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { getStripeClient, GRACE_PERIOD_DAYS } from '@/utils/stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new NextResponse('Webhook not configured', { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  async function logAudit(tenantId: string | undefined, action: string, metadata: Record<string, unknown>) {
    if (!tenantId) return;
    await db.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: null,
      action,
      target_type: 'subscription',
      target_id: metadata.stripe_subscription_id ?? metadata.stripe_customer_id ?? null,
      metadata,
    });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id;
      if (!tenantId) break;

      await db.from('subscriptions').update({
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        status: 'active',
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId);

      await logAudit(tenantId, 'subscription_activated', {
        stripe_customer_id: session.customer,
        stripe_subscription_id: session.subscription,
      });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      if (!tenantId) break;

      const status = subscription.status === 'active' ? 'active'
        : subscription.status === 'past_due' ? 'past_due'
        : subscription.status === 'canceled' ? 'canceled'
        : subscription.status === 'unpaid' ? 'unpaid'
        : 'incomplete';

      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

      await db.from('subscriptions').update({
        status,
        current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
        ...(status === 'active' ? { grace_period_ends_at: null } : {}),
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId);

      await logAudit(tenantId, `subscription_${status}`, {
        stripe_subscription_id: subscription.id,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscriptionId = (invoice as any).subscription as string | undefined;
      if (!subscriptionId) break;

      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const tenantId = subscription.metadata?.tenant_id;
      if (!tenantId) break;

      const graceEnds = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      await db.from('subscriptions').update({
        status: 'past_due',
        grace_period_ends_at: graceEnds,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId);

      await logAudit(tenantId, 'subscription_payment_failed', {
        stripe_subscription_id: subscriptionId,
        grace_period_ends_at: graceEnds,
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata?.tenant_id;
      if (!tenantId) break;

      await db.from('subscriptions').update({
        status: 'canceled',
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      }).eq('tenant_id', tenantId);

      await logAudit(tenantId, 'subscription_canceled', {
        stripe_subscription_id: subscription.id,
      });
      break;
    }

    default:
      break;
  }

  return new NextResponse('OK', { status: 200 });
}
