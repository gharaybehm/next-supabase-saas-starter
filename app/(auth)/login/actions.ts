'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Strip any trailing slash(es) so we never build a double-slash redirect URL —
// Supabase's redirect allow-list matches exactly and rejects "https://x.com//auth/callback".
function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export async function login(formData: FormData) {
  const rememberMe = formData.get('remember-me') === 'on'
  const supabase = await createClient(rememberMe)

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/tenants')
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string
  const rememberMe = formData.get('remember-me') === 'on'

  const supabase = await createClient(rememberMe)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  })

  if (error) {
    redirect(`/login?mode=signup&message=${encodeURIComponent(error.message)}`)
  }

  // Create the user profile in public.user_profiles. Role defaults to 'worker' —
  // this is a multi-tenant app, so a brand-new user has no tenant yet and gets
  // their real permissions from tenant_members once they create/join one.
  if (data.user) {
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: profileError } = await (adminClient.from('user_profiles') as any).insert({
      id: data.user.id,
      full_name: fullName || email.split('@')[0],
      updated_at: new Date().toISOString(),
    })

    if (profileError) {
      console.error('Failed to create user profile:', profileError)
    }
  }

  // Check if a session was established (i.e. email confirmation is disabled)
  if (data.session) {
    revalidatePath('/', 'layout')
    redirect('/tenants')
  } else {
    redirect(`/login?message=${encodeURIComponent('Sign up successful! Please check your email for a confirmation link.')}`)
  }
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  const redirectTo = `${appUrl()}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
    },
  })

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`)
  }

  if (data.url) {
    redirect(data.url)
  }
}
