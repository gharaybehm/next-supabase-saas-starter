// Next.js 16 request proxy (the replacement for middleware.ts). Refreshes the
// Supabase session on every request, sends signed-out visitors to /login, and
// passes the cookie locale to next-intl.
import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from './utils/supabase/middleware'
import { routing, LOCALE_COOKIE, type Locale } from '@/i18n/routing'

export async function proxy(request: NextRequest) {
  const supabaseResponse = await updateSession(request)

  // A redirect from the session check wins.
  if (supabaseResponse.status === 307 || supabaseResponse.status === 302) {
    return supabaseResponse
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value
  const locale: Locale = routing.locales.includes(cookieLocale as Locale)
    ? (cookieLocale as Locale)
    : routing.defaultLocale

  // next-intl's server helpers read the locale from this header.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-next-intl-locale', locale)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Carry over any refreshed Supabase cookies.
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|logo-full.png|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
