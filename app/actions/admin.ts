'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createHash, randomBytes } from 'crypto';

async function requireAdmin(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' as const, user: null, admin: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') return { error: 'Not authorized' as const, user: null, admin: null };

  return { error: null, user, admin: createAdminClient() };
}

export async function getAdminMembers(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // tenant_members.user_id and user_profiles both reference auth.users
  // independently — there's no direct foreign key between tenant_members
  // and user_profiles, so PostgREST can't auto-embed them in a single
  // nested select (it errors with PGRST200). Fetch separately and merge.
  const { data: members } = await db
    .from('tenant_members')
    .select('user_id, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at');

  if (!members?.length) return [];

  const userIds = members.map((m: { user_id: string }) => m.user_id);

  const { data: profiles } = await db
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds);

  const profileById = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));

  return members.map((m: { user_id: string; role: string; created_at: string }) => ({
    user_id: m.user_id,
    role: m.role,
    created_at: m.created_at,
    user_profiles: profileById.get(m.user_id) ?? null,
  }));
}

export async function removeMember(
  tenantId: string,
  userId: string
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('tenant_members')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function getAuditLogs(tenantId: string, page = 0, pageSize = 50) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('audit_logs')
    .select('id, action, target_type, target_id, metadata, created_at, actor_id, user_profiles(full_name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  return data ?? [];
}

export async function generateApiKey(
  tenantId: string,
  name: string
): Promise<{ key?: string; error?: string }> {
  const { error, user, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  const rawKey = `sk_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertError } = await (admin as any).from('api_keys').insert({
    tenant_id: tenantId,
    name,
    key_hash: keyHash,
    created_by: user!.id,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath(`/${tenantId}/admin`);
  return { key: rawKey };
}

export async function revokeApiKey(
  tenantId: string,
  keyId: string
): Promise<{ error?: string }> {
  const { error, admin } = await requireAdmin(tenantId);
  if (error || !admin) return { error: error ?? 'Not authorized' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any).from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('tenant_id', tenantId);

  revalidatePath(`/${tenantId}/admin`);
  return {};
}

export async function getApiKeys(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('api_keys')
    .select('id, name, created_at, last_used_at, revoked_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}

export async function getAdminInvitations(tenantId: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('invitations')
    .select('id, email, token, role, created_at, expires_at, used_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return data ?? [];
}
