// Hand-written types for the organizations tables
// (20261015000100_super_admin_and_billing.sql). Replace with the generated
// types once you run `npx supabase gen types`.

export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Statuses in which an organization may add tenants. */
export const SEAT_GRANTING_STATUSES: readonly SubscriptionStatus[] = ['trialing', 'active']

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === 'string' && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
}

/**
 * True when the organization has a Stripe subscription that can still be
 * managed in the Billing Portal. Otherwise the owner needs Checkout, even if a
 * Stripe customer already exists (an abandoned checkout leaves one behind).
 */
export function hasLiveSubscription(org: { stripe_subscription_id: string | null; subscription_status: string }): boolean {
  return Boolean(org.stripe_subscription_id) && !['canceled', 'incomplete_expired'].includes(org.subscription_status)
}

export interface Organization {
  id: string
  name: string
  slug: string
  billing_email: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus
  tenant_seats: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: OrganizationRole
  created_at: string
}
