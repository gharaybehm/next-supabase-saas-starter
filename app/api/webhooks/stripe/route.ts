/* eslint-disable @typescript-eslint/no-explicit-any -- organization tables are not in the generated Supabase types */
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/utils/stripe'
import { createAdminClient } from '@/utils/supabase/admin'
import { hasLiveSubscription, isSubscriptionStatus } from '@/utils/supabase/org-types'

// Stripe webhook: keeps organizations.subscription_status and tenant_seats in
// step with Stripe, and caches paid invoices for the operator's payment
// history.
//
// No session check: Stripe calls this directly and is authenticated by the
// `stripe-signature` header alone (proxy.ts lets /api through).
//
// Events arrive out of order and are retried, so subscription events never
// trust the payload's status: each one re-reads the subscription from Stripe
// and writes its current state. Writing the same state twice is harmless.
//
// Events to enable in the Stripe dashboard: checkout.session.completed,
// customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted, invoice.paid, invoice.payment_failed.
//
// Local testing: stripe listen --forward-to localhost:3000/api/webhooks/stripe

type Admin = ReturnType<typeof createAdminClient>

export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 })
  }

  // Verified from here on. A failed write returns 500 so Stripe retries it.
  try {
    const admin = createAdminClient()

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const organizationId = session.metadata?.organization_id
        const subscriptionId = idOf(session.subscription)
        if (organizationId && subscriptionId) {
          // A completed checkout is the organization's newest purchase: it
          // becomes the current subscription.
          await syncSubscription(admin, subscriptionId, { organizationId, makeCurrent: true })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await syncSubscription(admin, subscription.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
        if (subscriptionId) await syncSubscription(admin, subscriptionId)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const organizationId = await resolveInvoiceOrganization(admin, invoice)
        if (organizationId && invoice.id) {
          const { error } = await (admin as any).from('stripe_invoices').upsert({
            id: invoice.id,
            organization_id: organizationId,
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
            status: invoice.status,
            hosted_invoice_url: invoice.hosted_invoice_url,
            created_at: new Date(invoice.created * 1000).toISOString(),
            synced_at: new Date().toISOString(),
          })
          if (error) throw new Error(error.message)
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error('Stripe webhook handler error:', event.type, event.id, err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null
  return typeof ref === 'string' ? ref : ref.id
}

/**
 * Writes a subscription's current state (read from Stripe, not from the event)
 * onto its organization. A subscription that is not the organization's
 * current one is ignored, unless the current one is no longer live or
 * `makeCurrent` is set: an old, cancelled subscription must not cancel the
 * organization's new one.
 */
async function syncSubscription(
  admin: Admin,
  subscriptionId: string,
  opts: { organizationId?: string; makeCurrent?: boolean } = {},
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  const organizationId =
    opts.organizationId ??
    subscription.metadata?.organization_id ??
    (await organizationIdForCustomer(admin, idOf(subscription.customer)))
  if (!organizationId) return

  const { data: org, error: readError } = await (admin as any)
    .from('organizations')
    .select('stripe_subscription_id, subscription_status')
    .eq('id', organizationId)
    .maybeSingle()
  if (readError) throw new Error(readError.message)
  if (!org) return

  const isCurrent = org.stripe_subscription_id === subscription.id
  if (!isCurrent && !opts.makeCurrent && hasLiveSubscription(org)) return

  const seats = subscription.items.data[0]?.quantity
  const { error } = await (admin as any)
    .from('organizations')
    .update({
      stripe_customer_id: idOf(subscription.customer),
      stripe_subscription_id: subscription.id,
      // Status only: an organization and its tenants are never deleted here.
      subscription_status: isSubscriptionStatus(subscription.status) ? subscription.status : 'incomplete',
      ...(seats != null ? { tenant_seats: seats } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
  if (error) throw new Error(error.message)
}

async function organizationIdForCustomer(admin: Admin, customerId: string | null): Promise<string | null> {
  if (!customerId) return null
  const { data: org } = await (admin as any)
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()
  return org?.id ?? null
}

// Invoices carry the subscription's metadata, not their own: resolve through
// the subscription, falling back to the Stripe customer id.
async function resolveInvoiceOrganization(admin: Admin, invoice: Stripe.Invoice): Promise<string | null> {
  const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription)
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.metadata?.organization_id) return subscription.metadata.organization_id
  }
  return organizationIdForCustomer(admin, idOf(invoice.customer))
}
