'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendInviteEmail } from '@/utils/email'

type Role = 'admin' | 'supervisor' | 'worker'

export async function updateMemberRole(tenantId: string, userId: string, role: Role) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Per-tenant role is authoritative — check the caller is an admin on THIS tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curMembership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (curMembership?.role !== 'admin') {
    return { error: 'Only admins can change user roles' }
  }

  const adminClient = createAdminClient()
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (userId === user.id) {
    return { error: 'You cannot remove yourself from the tenant' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curMembership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (curMembership?.role !== 'admin') {
    return { error: 'Only admins can remove team members' }
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: curMembership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  if (curMembership?.role !== 'admin' && curMembership?.role !== 'supervisor') {
    return { error: 'Only admins and supervisors can add team members' }
  }

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as 'supervisor' | 'worker'

  if (!email || !fullName || !role) {
    return { error: 'All fields are required' }
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

  // 2. Insert into user_profiles (global role defaults to 'worker' via schema default —
  // the per-tenant role below is what actually governs their permissions in this tenant)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (adminClient.from('user_profiles') as any).insert({
    id: newUser.user.id,
    full_name: fullName,
  })

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
      appUrl: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, ''),
    })
  } catch (err) {
    emailWarning = `Account created, but the invite email failed to send: ${err instanceof Error ? err.message : 'unknown error'}. Use "Copy invite message" to share the login details instead.`
  }

  revalidatePath(`/${tenantId}/settings`)
  return { success: `Successfully added new ${role}`, isNewUser: true, warning: emailWarning }
}
