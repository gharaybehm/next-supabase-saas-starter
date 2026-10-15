import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from './types'
import { REMEMBER_ME_COOKIE, applyRememberMe, readRememberMe, rememberMeCookieOptions } from './remember-me'

/**
 * Server Supabase client. Pass `rememberMe` only at sign-in: it is stored in
 * its own cookie, and every later client (and the request proxy) applies the
 * stored choice when it rewrites the auth cookies.
 */
export async function createClient(rememberMe?: boolean) {
  const cookieStore = await cookies()

  if (rememberMe !== undefined) {
    try {
      cookieStore.set(REMEMBER_ME_COOKIE, rememberMe ? '1' : '0', rememberMeCookieOptions(rememberMe))
    } catch {
      // Server Component: cookies are read-only here, and sign-in never runs here.
    }
  }
  const choice = rememberMe ?? readRememberMe(cookieStore.get(REMEMBER_ME_COOKIE)?.value)

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, applyRememberMe(options, choice))
            })
          } catch {
            // Called from a Server Component: safe to ignore; the proxy refreshes the session.
          }
        },
      },
    }
  )
}
