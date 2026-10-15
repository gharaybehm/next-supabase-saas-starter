/**
 * A `next` redirect target that can only point at a path on this site.
 *
 * The value is appended to the host, so "@evil.example", "//evil.example" or
 * "/\evil.example" would send the user to another site after sign-in.
 */
export function safeNextPath(requested: string | null | undefined, fallback = '/tenants'): string {
  return requested && /^\/(?![/\\])/.test(requested) ? requested : fallback
}
