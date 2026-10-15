/* eslint-disable @typescript-eslint/no-explicit-any -- tenant tables are not in the generated Supabase types */
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { TenantWithMeta } from '@/utils/supabase/tenant-types';
import { requireTenantRole } from '@/utils/supabase/tenant-access';
import { SEAT_GRANTING_STATUSES } from '@/utils/supabase/org-types';
import { getOrCreateOrganizationForUser } from '@/app/actions/organizations';
import { toSlug } from '@/utils/slug';
import { getCurrentUser } from '@/utils/supabase/current-user';

export async function createTenant(values: {
  name: string;
  description?: string;
}): Promise<{ tenantId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Not authenticated' };

  const name = values.name?.trim();
  if (!name) return { error: 'A name is required.' };

  // The organization's seats are the limit. A user with no organization gets a
  // one-person one here (see app/actions/organizations.ts).
  const { organization, error: orgError } = await getOrCreateOrganizationForUser();
  if (orgError || !organization) return { error: orgError ?? 'Could not resolve your organization.' };

  if (!SEAT_GRANTING_STATUSES.includes(organization.subscription_status)) {
    return { error: 'Your subscription is not active. Update billing to add workspaces.' };
  }

  const { count: tenantCount } = await (admin as any)
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organization.id);
  if ((tenantCount ?? 0) >= organization.tenant_seats) {
    return { error: `You have reached your plan's limit of ${organization.tenant_seats} workspace${organization.tenant_seats === 1 ? '' : 's'}.` };
  }

  const slug = toSlug(name, 'tenant');

  const insertTenant = async (s: string) =>
    (admin as any).from('tenants').insert({
      name,
      slug: s,
      created_by: user.id,
      organization_id: organization.id,
      description: values.description?.trim() || null,
    }).select('id').single();

  let { data: tenant, error: tenantError } = await insertTenant(slug);

  if (tenantError) {
    if (tenantError.code === '23505') {
      // Slug collision — append a short random suffix and retry once
      const retrySlug = `${slug}-${Date.now().toString(36)}`;
      const retry = await insertTenant(retrySlug);
      tenant = retry.data;
      tenantError = retry.error;
    }
    if (tenantError) return { error: tenantError.message };
  }

  // Add creator as admin member
  const { error: memberError } = await (admin as any).from('tenant_members').insert({
    tenant_id: tenant!.id,
    user_id: user.id,
    role: 'admin',
  });

  if (memberError) return { error: memberError.message };

  revalidatePath('/tenants');
  return { tenantId: tenant!.id };
}

export async function getTenants(): Promise<TenantWithMeta[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();

  const db = supabase as any;
  // Named columns, not '*': this result is passed to client components, so a
  // column added later for server use only must not reach the browser.
  const { data: tenantsRaw } = await db.from('tenants')
    .select('id, name, slug, description, created_by, created_at, updated_at, organization_id, tenant_members(role, user_id)')
    .order('created_at');

  if (!tenantsRaw || tenantsRaw.length === 0) return [];

  return tenantsRaw.map((t: { id: string; tenant_members: { user_id: string; role: string }[] } & Record<string, unknown>) => ({
    ...t,
    userRole: t.tenant_members?.find((m) => m.user_id === user.id)?.role ?? 'worker',
  })) as TenantWithMeta[];
}

export async function deleteTenant(tenantId: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const gate = await requireTenantRole(tenantId, 'admin');
  if (!gate.ok) return { error: gate.error };

  const { error } = await (admin as any).from('tenants').delete().eq('id', tenantId);
  if (error) return { error: error.message };

  revalidatePath('/tenants');
  return {};
}

export async function updateTenant(
  tenantId: string,
  values: { name?: string; description?: string }
): Promise<{ error?: string }> {
  const gate = await requireTenantRole(tenantId, 'admin');
  if (!gate.ok) return { error: gate.error };

  // `values` comes from the client, so only the fields this form edits are
  // copied; anything else (organization_id, created_by, ...) is dropped. The
  // column grants in 20261015000000_tenant_hardening.sql enforce the same list.
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof values.name === 'string') {
    const name = values.name.trim();
    if (!name) return { error: 'A name is required.' };
    payload.name = name;
  }
  if (typeof values.description === 'string') payload.description = values.description.trim() || null;

  const supabase = await createClient();
  const { error } = await (supabase as any).from('tenants')
    .update(payload)
    .eq('id', tenantId);

  if (error) return { error: error.message };

  revalidatePath('/tenants');
  revalidatePath(`/${tenantId}/settings`);
  return {};
}
