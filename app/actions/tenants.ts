'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import type { TenantWithMeta } from '@/utils/supabase/tenant-types';

function toSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'tenant'
  );
}

export async function createTenant(values: {
  name: string;
  description?: string;
}): Promise<{ tenantId?: string; error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Not authenticated' };

  // Enforce 3-tenant maximum per user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase as any)
    .from('tenant_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if ((count ?? 0) >= 3) {
    return { error: 'You have reached the maximum of 3 tenants.' };
  }

  const slug = toSlug(values.name);

  const insertTenant = async (s: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).from('tenants').insert({
      name: values.name.trim(),
      slug: s,
      created_by: user.id,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: tenantsRaw } = await db.from('tenants')
    .select('*, tenant_members(role, user_id)')
    .order('created_at');

  if (!tenantsRaw || tenantsRaw.length === 0) return [];

  return tenantsRaw.map((t: { id: string; tenant_members: { user_id: string; role: string }[] } & Record<string, unknown>) => ({
    ...t,
    userRole: t.tenant_members?.find((m) => m.user_id === user.id)?.role ?? 'worker',
  })) as TenantWithMeta[];
}

export async function deleteTenant(tenantId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any).from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') return { error: 'Only admins can delete tenants' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any).from('tenants').delete().eq('id', tenantId);
  if (error) return { error: error.message };

  revalidatePath('/tenants');
  return {};
}

export async function updateTenant(
  tenantId: string,
  values: { name?: string; description?: string }
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('tenants')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', tenantId);

  if (error) return { error: error.message };

  revalidatePath('/tenants');
  revalidatePath(`/${tenantId}/settings`);
  return {};
}
