import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'

/**
 * Checks a scheduled-job request against CRON_SECRET. Returns a response to
 * send back when the request is refused, or null when it may proceed.
 *
 * The secret goes in the Authorization header, not the URL: query strings end
 * up in proxy and access logs. Call it as
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://your.app/api/cron/<job>
 *
 * Fails closed: with no CRON_SECRET set, every request is refused in
 * production; in development the check is skipped so the job can be tried.
 */
export function rejectUnauthorizedCron(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
    }
    return null
  }

  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!secretsMatch(given, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export function secretsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
