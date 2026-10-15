// "Remember me" has to survive token refreshes. The session cookies are
// rewritten whenever the access token is refreshed, by the request proxy as
// well as by server code, so the choice made at sign-in is kept in its own
// cookie and applied by every writer of the auth cookies.

export const REMEMBER_ME_COOKIE = 'app-remember-me'

const THIRTY_DAYS = 60 * 60 * 24 * 30

export type CookieOptions = { maxAge?: number; expires?: Date; [key: string]: unknown }

/** The stored choice: true, false, or null when none was made (e.g. OAuth sign-in). */
export function readRememberMe(value: string | undefined): boolean | null {
  if (value === '1') return true
  if (value === '0') return false
  return null
}

/**
 * Cookie options for an auth cookie under the given choice: a session cookie
 * (gone when the browser closes) when false, 30 days when true, the library's
 * default when no choice was made.
 */
export function applyRememberMe<T extends CookieOptions>(options: T, rememberMe: boolean | null): T {
  const adjusted = { ...options }
  if (rememberMe === false) {
    delete adjusted.maxAge
    delete adjusted.expires
  } else if (rememberMe === true) {
    adjusted.maxAge = THIRTY_DAYS
    delete adjusted.expires
  }
  return adjusted
}

/** Options for the preference cookie itself, which lives as long as the session it describes. */
export function rememberMeCookieOptions(rememberMe: boolean) {
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    ...(rememberMe ? { maxAge: THIRTY_DAYS } : {}),
  }
}
