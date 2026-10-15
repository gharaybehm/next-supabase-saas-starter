/* eslint-disable @typescript-eslint/no-explicit-any -- organization tables are not in the generated Supabase types */
'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { stripe } from '@/utils/stripe';
import { appUrl } from '@/utils/app-url';
import { safeNextPath } from '@/utils/safe-redirect';
import { toSlug } from '@/utils/slug';
import { hasLiveSubscription, type Organization, type OrganizationRole } from '@/utils/supabase/org-types';

/**
 * The caller's organization, creating a one-person one (with the caller as
 * owner) if they have none. Every tenant needs an owning organization for
 * seat-based billing, but solo users should never see a "create an
 * organization" step, so it happens silently on their first tenant.
 *
 * Safe to call twice at once: a user owns at most one organization
 * (organization_members_one_owned_per_user), so the second call's membership
 * insert fails, its organization is removed, and the first one is returned.
 */
export async function getOrCreateOrganizationForUser(): Promise<{ organization?: Organization; error?: string }> {
  const existing = await getOrganizationForUser();
  if (existing) return { organization: existing };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Not authenticated' };

  const admin = createAdminClient();
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'My';
  const name = `${fullName}'s Organization`;
  const slug = toSlug(name, 'org');

  const insertOrg = async (s: string) =>
    (admin as any).from('organizations').insert({
      name,
      slug: s,
      billing_email: user.email,
      created_by: user.id,
    }).select('*').single();

  let { data: org, error: orgError } = await insertOrg(slug);
  if (orgError?.code === '23505') {
    ({ data: org, error: orgError } = await insertOrg(`${slug}-${crypto.randomUUID().slice(0, 8)}`));
  }
  if (orgError || !org) return { error: orgError?.message ?? 'Could not create your organization' };

  const { error: memberError } = await (admin as any).from('organization_members').insert({
    organization_id: org.id,
    user_id: user.id,
    role: 'owner',
  });
  if (memberError) {
    await (admin as any).from('organizations').delete().eq('id', org.id);
    if (memberError.code === '23505') {
      const winner = await getOrganizationForUser();
      if (winner) return { organization: winner };
    }
    return { error: memberError.message };
  }

  return { organization: org as Organization };
}

export async function getOrganizationForUser(): Promise<(Organization & { myRole: OrganizationRole }) | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // The organization they own first, else the oldest they belong to.
  const { data: memberships } = await (supabase as any)
    .from('organization_members')
    .select('organization_id, role, created_at')
    .eq('user_id', user.id)
    .order('created_at');
  const rows = (memberships ?? []) as { organization_id: string; role: OrganizationRole }[];
  const membership = rows.find((m) => m.role === 'owner') ?? rows[0];
  if (!membership) return null;

  const { data: org } = await (supabase as any)
    .from('organizations')
    .select('*')
    .eq('id', membership.organization_id)
    .single();
  return org ? { ...(org as Organization), myRole: membership.role } : null;
}

/** Billing is the owner's alone: narrower than organization admin or member. */
async function requireOrganizationOwner(organizationId: string): Promise<{ org?: Organization; error?: string }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Not authenticated' };

  const { data: membership } = await (supabase as any)
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (membership?.role !== 'owner') return { error: 'Only the organization owner can manage billing' };

  const { data: org, error } = await (createAdminClient() as any)
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single();
  if (error || !org) return { error: error?.message ?? 'Organization not found' };
  return { org: org as Organization };
}

function stripeErrorMessage(e: unknown): string {
  console.error('Stripe call failed:', e);
  return 'Stripe could not be reached or refused the request. Try again, or check the billing settings.';
}

/**
 * A Stripe Checkout session (subscription mode, one line item per tenant seat)
 * for the caller's organization. Returns the URL to send the browser to.
 * Refused while a live subscription exists; that one is changed in the portal.
 */
export async function createCheckoutSession(organizationId: string): Promise<{ url?: string; error?: string }> {
  const { org, error } = await requireOrganizationOwner(organizationId);
  if (error || !org) return { error };
  if (hasLiveSubscription(org)) return { error: 'This organization already has a subscription. Use Manage billing.' };

  const priceId = process.env.STRIPE_PRICE_ID_TENANT_SEAT;
  if (!priceId) return { error: 'Billing is not configured (missing STRIPE_PRICE_ID_TENANT_SEAT)' };

  try {
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: org.billing_email,
        name: org.name,
        metadata: { organization_id: org.id },
      });
      customerId = customer.id;
      await (createAdminClient() as any).from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: Math.max(1, org.tenant_seats) }],
      success_url: `${appUrl()}/tenants?checkout=success`,
      cancel_url: `${appUrl()}/tenants?checkout=cancelled`,
      metadata: { organization_id: org.id },
      subscription_data: { metadata: { organization_id: org.id } },
    });

    if (!session.url) return { error: 'Stripe did not return a checkout URL' };
    return { url: session.url };
  } catch (e) {
    return { error: stripeErrorMessage(e) };
  }
}

/**
 * A Stripe Billing Portal session, where the owner changes seats, card or
 * plan, or cancels. Changes come back through the webhook.
 */
export async function createBillingPortalSession(
  organizationId: string,
  returnPath = '/tenants',
): Promise<{ url?: string; error?: string }> {
  const { org, error } = await requireOrganizationOwner(organizationId);
  if (error || !org) return { error };
  if (!org.stripe_customer_id || !hasLiveSubscription(org)) return { error: 'There is no subscription to manage yet.' };

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl()}${safeNextPath(returnPath)}`,
    });
    return { url: session.url };
  } catch (e) {
    return { error: stripeErrorMessage(e) };
  }
}
