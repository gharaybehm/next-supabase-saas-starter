/* eslint-disable @typescript-eslint/no-explicit-any -- tenant_members is not in the generated Supabase types */
import { createClient } from '@/utils/supabase/server';
import { RANK, type TenantRole } from '@/utils/supabase/roles';
import { getCurrentUser } from '@/utils/supabase/current-user';

export { atLeast, type TenantRole } from '@/utils/supabase/roles';

export interface TenantActor {
  userId: string;
  role: TenantRole;
}

/**
 * The caller's role on one tenant, or null if they are signed out or not a
 * member. Always the per-tenant `tenant_members.role`: the platform-wide
 * `user_profiles.role` is a different axis (it carries 'super_admin', which
 * never grants access to a specific tenant) and must not be used for gating.
 */
export async function getTenantActor(tenantId: string): Promise<TenantActor | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) return null;
  return { userId: user.id, role: membership.role as TenantRole };
}

/**
 * Gate a server action or route handler. Returns the actor on success, or an
 * error string to hand back to the client.
 *
 * RLS enforces the same matrix in the database, so this is defence in depth
 * rather than the only guard, but it produces a readable message instead of a
 * silent zero-row write, and it covers the paths that use the service-role
 * client (which bypasses RLS entirely).
 */
export type TenantRoleGate =
  | { ok: true; actor: TenantActor; error?: undefined }
  | { ok: false; actor?: undefined; error: string };

export async function requireTenantRole(tenantId: string, minimum: TenantRole): Promise<TenantRoleGate> {
  const actor = await getTenantActor(tenantId);
  if (!actor) return { ok: false, error: 'You do not have access to this workspace.' };

  if (RANK.indexOf(actor.role) < RANK.indexOf(minimum)) {
    return { ok: false, error: `This action requires the ${minimum} role.` };
  }
  return { ok: true, actor };
}

/**
 * Display names for every member of a tenant, keyed by user id, for rendering
 * attribution. Depends on the `tenant_comembers_read_profiles` policy in
 * 20261015000000_tenant_hardening.sql.
 */
export async function getTenantMemberNames(tenantId: string): Promise<Map<string, string>> {
  const supabase = await createClient();

  const { data: members } = await (supabase as any)
    .from('tenant_members')
    .select('user_id')
    .eq('tenant_id', tenantId);

  const ids: string[] = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (ids.length === 0) return new Map();

  const { data: profiles } = await (supabase as any)
    .from('user_profiles')
    .select('id, full_name')
    .in('id', ids);

  return new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [
      p.id,
      p.full_name?.trim() || 'Unknown user',
    ]),
  );
}
