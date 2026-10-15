'use server'

// Every write here uses the service-role client, which bypasses RLS, so each
// action checks the caller's role on this tenant with requireTenantRole and
// validates every value that came from the form.

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendInviteEmail } from '@/utils/email'
import { requireTenantRole } from '@/utils/supabase/tenant-access'
import { isTenantRole } from '@/utils/supabase/roles'
import { appUrl } from '@/utils/app-url'

export async function updateMemberRole(tenantId: string, userId: string, role: unknown) {
  const gate = await requireTenantRole(tenantId, 'admin')
  if (!gate.ok) return { error: 'Only admins can change user roles' }
  if (!isTenantRole(role)) return { error: 'Invalid role' }

  const adminClient = createAdminClient()

  // Demoting the last admin would leave the tenant with nobody who can manage it.
  if (role !== 'admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: target } = await (adminClient as any)
      .from('tenant_members')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()
    if (target?.role === 'admin') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (adminClient as any)
        .from('tenant_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('role', 'admin')
      if ((count ?? 0) <= 1) return { error: 'Cannot demote the only admin of this tenant' }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('tenant_members')
    .update({ role })
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  revalidatePath(`/${tenantId}/settings`)
  return { success: 'User role updated successfully' }
}

export async function removeMember(tenantId: string, userId: string) {
  const gate = await requireTenantRole(tenantId, 'admin')
  if (!gate.ok) return { error: 'Only admins can remove team members' }

  if (userId === gate.actor.userId) {
    return { error: 'You cannot remove yourself from the tenant' }
  }

  const adminClient = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: targetMembership } = await (adminClient as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single()

  if (targetMembership?.role === 'admin') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (adminClient as any)
      .from('tenant_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return { error: 'Cannot remove the only admin of this tenant' }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (adminClient as any)
    .from('tenant_members')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (error) return { error: error.message }

  revalidatePath(`/${tenantId}/settings`)
  return { success: 'Member removed from this tenant' }
}

// Supabase's admin listUsers() has no email filter, so finding an existing
// auth user by email means paginating and matching client-side.
async function findAuthUserByEmail(
  adminClient: ReturnType<typeof createAdminClient>,
  email: string
): Promise<{ id: string; email: string } | null> {
  const PER_PAGE = 1000
  const MAX_PAGES = 20
  const target = email.trim().toLowerCase()

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) throw new Error(`Failed to look up existing users: ${error.message}`)

    const match = data.users.find(u => u.email?.toLowerCase() === target)
    if (match) return { id: match.id, email: match.email! }
    if (data.users.length < PER_PAGE) return null
  }

  throw new Error('Too many users to search — user lookup limit exceeded')
}

export async function addTeamMember(tenantId: string, formData: FormData) {
  const gate = await requireTenantRole(tenantId, 'supervisor')
  if (!gate.ok) return { error: 'Only admins and supervisors can add team members' }

  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fullName = String(formData.get('full_name') ?? '').trim()
  const role = formData.get('role')

  if (!email || !fullName || !role) {
    return { error: 'All fields are required' }
  }

  // The form value is caller-controlled and the inserts below bypass RLS:
  // nobody is added as admin here, and a supervisor can only add workers.
  if (role !== 'supervisor' && role !== 'worker') {
    return { error: 'Role must be supervisor or worker' }
  }
  if (gate.actor.role === 'supervisor' && role !== 'worker') {
    return { error: 'Supervisors can only add workers' }
  }

  const adminClient = createAdminClient()

  let existingUserId: string | null = null
  try {
    const existing = await findAuthUserByEmail(adminClient, email)
    existingUserId = existing?.id ?? null
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to look up existing users' }
  }

  // Existing account: just scope them to this tenant, don't touch their global profile
  if (existingUserId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMembership } = await (adminClient as any)
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', existingUserId)
      .maybeSingle()

    if (existingMembership) {
      return { error: 'This user is already a team member of this tenant.' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: memberError } = await (adminClient as any).from('tenant_members').insert({
      tenant_id: tenantId,
      user_id: existingUserId,
      role,
    })

    if (memberError) return { error: memberError.message }

    revalidatePath(`/${tenantId}/settings`)
    return { success: `Added existing user to this tenant as ${role}`, isNewUser: false }
  }

  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  // 1. Create the auth user
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !newUser.user) {
    return { error: createError?.message || 'Failed to create auth user' }
  }

  // 2. Make sure the profile exists. Upsert, because the on_auth_user_created
  // trigger has usually made it already. The platform-wide role stays at its
  // default; the tenant role lives in tenant_members (step 3).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (adminClient.from('user_profiles') as any).upsert({
    id: newUser.user.id,
    full_name: fullName,
  }, { onConflict: 'id' })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return { error: profileError.message }
  }

  // 3. Scope the new user to this tenant — without this row they'd never appear
  // in this tenant's Team tab or be able to access it at all
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: memberError } = await (adminClient as any).from('tenant_members').insert({
    tenant_id: tenantId,
    user_id: newUser.user.id,
    role,
  })

  if (memberError) {
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return { error: memberError.message }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (adminClient as any)
    .from('tenants')
    .select('name')
    .eq('id', tenantId)
    .single()

  let emailWarning: string | undefined
  try {
    await sendInviteEmail(email, {
      tenantName: tenant?.name || 'your tenant',
      email,
      password,
      appUrl: appUrl(),
    })
  } catch (err) {
    emailWarning = `Account created, but the invite email failed to send: ${err instanceof Error ? err.message : 'unknown error'}. Use "Copy invite message" to share the login details instead.`
  }

  revalidatePath(`/${tenantId}/settings`)
  return { success: `Successfully added new ${role}`, isNewUser: true, warning: emailWarning }
}
