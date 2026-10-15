/* eslint-disable @typescript-eslint/no-explicit-any -- tenant and organization tables are not in the generated Supabase types */
'use server';

// Platform operator (super_admin) reads. The operator is not a member of any
// tenant: these return counts, times, names and settings only, never what a
// tenant's users wrote. Every read uses the service-role client, so every
// function starts with requireSuperAdmin().

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

type Admin = ReturnType<typeof createAdminClient>;

async function requireSuperAdmin(): Promise<{ userId: string; error?: undefined } | { userId?: undefined; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };
  const { data: profile } = await (supabase as any)
    .from('user_profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return { error: 'Super admin access required' };
  return { userId: user.id };
}

/** Emails and last sign-in for the given users. listUsers has no id filter, so it pages. */
async function authDetails(admin: Admin, ids: string[]): Promise<Map<string, { email: string | null; lastSignInAt: string | null }>> {
  const wanted = new Set(ids);
  const found = new Map<string, { email: string | null; lastSignInAt: string | null }>();
  const PER_PAGE = 1000;
  for (let page = 1; wanted.size > found.size && page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) break;
    for (const u of data.users) {
      if (wanted.has(u.id)) found.set(u.id, { email: u.email ?? null, lastSignInAt: u.last_sign_in_at ?? null });
    }
    if (data.users.length < PER_PAGE) break;
  }
  return found;
}

async function profileNames(admin: Admin, ids: string[]): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const { data } = await (admin as any).from('user_profiles').select('id, full_name').in('id', ids);
  return new Map(((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
}

export interface TenantOverviewRow {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  organizationName: string | null;
  subscriptionStatus: string | null;
  memberCount: number;
  createdAt: string;
}

export async function getTenantOverview(): Promise<{ tenants?: TenantOverviewRow[]; error?: string }> {
  const gate = await requireSuperAdmin();
  if (gate.error) return { error: gate.error };

  const admin = createAdminClient();
  const { data: tenants, error } = await (admin as any)
    .from('tenants')
    .select('id, name, created_by, created_at, organizations(name, subscription_status), tenant_members(user_id)')
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };

  const ownerIds = [...new Set(((tenants ?? []) as any[]).map((t) => t.created_by).filter(Boolean))] as string[];
  const [names, auth] = await Promise.all([profileNames(admin, ownerIds), authDetails(admin, ownerIds)]);

  return {
    tenants: ((tenants ?? []) as any[]).map((t) => ({
      id: t.id,
      name: t.name,
      ownerName: names.get(t.created_by) ?? null,
      ownerEmail: auth.get(t.created_by)?.email ?? null,
      organizationName: t.organizations?.name ?? null,
      subscriptionStatus: t.organizations?.subscription_status ?? null,
      memberCount: t.tenant_members?.length ?? 0,
      createdAt: t.created_at,
    })),
  };
}

export interface TenantDetail {
  tenant: { id: string; name: string; createdAt: string; organizationName: string | null; subscriptionStatus: string | null };
  members: { id: string; name: string | null; email: string | null; role: string; lastSignInAt: string | null }[];
}

/** One tenant for the operator: who is in it and when they last signed in. No tenant content. */
export async function getTenantDetail(tenantId: string): Promise<{ detail?: TenantDetail; error?: string }> {
  const gate = await requireSuperAdmin();
  if (gate.error) return { error: gate.error };

  const admin = createAdminClient();
  const { data: tenant, error } = await (admin as any)
    .from('tenants')
    .select('id, name, created_at, organizations(name, subscription_status), tenant_members(user_id, role)')
    .eq('id', tenantId)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!tenant) return { error: 'Tenant not found' };

  const memberRows = (tenant.tenant_members ?? []) as { user_id: string; role: string }[];
  const ids = memberRows.map((m) => m.user_id);
  const [names, auth] = await Promise.all([profileNames(admin, ids), authDetails(admin, ids)]);

  return {
    detail: {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.created_at,
        organizationName: tenant.organizations?.name ?? null,
        subscriptionStatus: tenant.organizations?.subscription_status ?? null,
      },
      members: memberRows.map((m) => ({
        id: m.user_id,
        name: names.get(m.user_id) ?? null,
        email: auth.get(m.user_id)?.email ?? null,
        role: m.role,
        lastSignInAt: auth.get(m.user_id)?.lastSignInAt ?? null,
      })),
    },
  };
}

export interface SubscriberRow {
  id: string;
  name: string;
  billingEmail: string;
  subscriptionStatus: string;
  tenantSeats: number;
  tenantCount: number;
  memberCount: number;
  createdAt: string;
}

export async function getSubscribers(): Promise<{ subscribers?: SubscriberRow[]; error?: string }> {
  const gate = await requireSuperAdmin();
  if (gate.error) return { error: gate.error };

  const admin = createAdminClient();
  const { data: orgs, error } = await (admin as any)
    .from('organizations')
    .select('id, name, billing_email, subscription_status, tenant_seats, created_at, tenants(id), organization_members(id)')
    .order('created_at', { ascending: false });
  if (error) return { error: error.message };

  return {
    subscribers: ((orgs ?? []) as any[]).map((o) => ({
      id: o.id,
      name: o.name,
      billingEmail: o.billing_email,
      subscriptionStatus: o.subscription_status,
      tenantSeats: o.tenant_seats,
      tenantCount: o.tenants?.length ?? 0,
      memberCount: o.organization_members?.length ?? 0,
      createdAt: o.created_at,
    })),
  };
}

export interface SubscriberDetail {
  id: string;
  name: string;
  billingEmail: string;
  subscriptionStatus: string;
  tenantSeats: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string;
  members: { id: string; name: string | null; email: string | null; role: string }[];
  tenants: { id: string; name: string; createdAt: string }[];
  invoices: { id: string; amountPaid: number; currency: string; status: string; hostedInvoiceUrl: string | null; createdAt: string }[];
}

export async function getSubscriberDetail(orgId: string): Promise<{ subscriber?: SubscriberDetail; error?: string }> {
  const gate = await requireSuperAdmin();
  if (gate.error) return { error: gate.error };

  const admin = createAdminClient();
  const { data: org, error: orgError } = await (admin as any)
    .from('organizations')
    .select('id, name, billing_email, subscription_status, tenant_seats, stripe_customer_id, stripe_subscription_id, created_at')
    .eq('id', orgId)
    .maybeSingle();
  if (orgError || !org) return { error: orgError?.message ?? 'Subscriber not found' };

  const [{ data: members }, { data: tenants }, { data: invoices }] = await Promise.all([
    (admin as any).from('organization_members').select('id, user_id, role').eq('organization_id', orgId),
    (admin as any).from('tenants').select('id, name, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }),
    (admin as any).from('stripe_invoices').select('id, amount_paid, currency, status, hosted_invoice_url, created_at').eq('organization_id', orgId).order('created_at', { ascending: false }),
  ]);

  const ids = ((members ?? []) as any[]).map((m) => m.user_id as string);
  const [names, auth] = await Promise.all([profileNames(admin, ids), authDetails(admin, ids)]);

  return {
    subscriber: {
      id: org.id,
      name: org.name,
      billingEmail: org.billing_email,
      subscriptionStatus: org.subscription_status,
      tenantSeats: org.tenant_seats,
      stripeCustomerId: org.stripe_customer_id,
      stripeSubscriptionId: org.stripe_subscription_id,
      createdAt: org.created_at,
      members: ((members ?? []) as any[]).map((m) => ({
        id: m.id,
        name: names.get(m.user_id) ?? null,
        email: auth.get(m.user_id)?.email ?? null,
        role: m.role,
      })),
      tenants: ((tenants ?? []) as any[]).map((t) => ({ id: t.id, name: t.name, createdAt: t.created_at })),
      invoices: ((invoices ?? []) as any[]).map((i) => ({
        id: i.id,
        amountPaid: i.amount_paid,
        currency: i.currency,
        status: i.status,
        hostedInvoiceUrl: i.hosted_invoice_url,
        createdAt: i.created_at,
      })),
    },
  };
}
