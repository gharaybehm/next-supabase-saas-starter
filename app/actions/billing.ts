'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getStripeClient } from '@/utils/stripe';

async function requireTenantAdmin(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' } as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') {
    return { error: 'Only the tenant administrator can manage billing.' } as const;
  }

  return { user } as const;
}

export async function createCheckoutSession(
  tenantId: string
): Promise<{ url?: string; error?: string }> {
  const auth = await requireTenantAdmin(tenantId);
  if ('error' in auth) return { error: auth.error };

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return { error: 'STRIPE_PRICE_ID not configured.' };

  const admin = createAdminClient();
  const stripe = getStripeClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: existing } = await db
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .single();

  let customerId = existing?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email ?? undefined,
      metadata: { tenant_id: tenantId },
    });
    customerId = customer.id;

    await db.from('subscriptions').upsert(
      { tenant_id: tenantId, stripe_customer_id: customerId, status: 'incomplete' },
      { onConflict: 'tenant_id' }
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/${tenantId}/billing?checkout=success`,
    cancel_url: `${baseUrl}/${tenantId}/billing?checkout=canceled`,
    metadata: { tenant_id: tenantId },
    subscription_data: { metadata: { tenant_id: tenantId } },
  });

  if (!session.url) return { error: 'Failed to create checkout session.' };
  return { url: session.url };
}

export async function createBillingPortalSession(
  tenantId: string
): Promise<{ url?: string; error?: string }> {
  const auth = await requireTenantAdmin(tenantId);
  if ('error' in auth) return { error: auth.error };

  const admin = createAdminClient();
  const stripe = getStripeClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscription } = await (admin as any)
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('tenant_id', tenantId)
    .single();

  if (!subscription?.stripe_customer_id) {
    return { error: 'No billing account found for this tenant yet.' };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${baseUrl}/${tenantId}/billing`,
  });

  return { url: session.url };
}
