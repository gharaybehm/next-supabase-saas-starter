import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { safeNextPath } from '@/utils/safe-redirect'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Only a path on this site: the value is appended to the host below.
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Check if the global user_profiles row exists yet
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!profile) {
          // The on_auth_user_created trigger normally makes it; this covers a
          // database without the trigger. The role is left at the column
          // default: tenant access comes from tenant_members, never from here.
          const adminClient = createAdminClient()
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'New User'

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminClient.from('user_profiles') as any).upsert({
            id: user.id,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id', ignoreDuplicates: true })
        }
      }

      // Check forwarded host for redirects in production (behind a proxy/load balancer)
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Redirect to login page with an error message if the exchange failed
  return NextResponse.redirect(`${origin}/login?message=${encodeURIComponent('Could not exchange OAuth token')}`)
}
