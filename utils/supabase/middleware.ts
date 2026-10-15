import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { REMEMBER_ME_COOKIE, applyRememberMe, readRememberMe } from './remember-me'

// Paths a signed-out visitor may open. /api routes authenticate themselves
// (session, CRON_SECRET or a webhook signature), so they are not redirected.
const PUBLIC_PREFIXES = ['/login', '/auth', '/api']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  // A refresh rewrites the auth cookies; keep the lifetime chosen at sign-in.
  const rememberMe = readRememberMe(request.cookies.get(REMEMBER_ME_COOKIE)?.value)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, applyRememberMe(options, rememberMe))
          )
        },
      },
    }
  )

  // Nothing may run between createServerClient and getUser(): the call
  // refreshes the session cookie, and code in between can sign users out at
  // random.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  if (!user && !PUBLIC_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && path.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/tenants'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
