import { NextResponse } from 'next/server'
import { rejectUnauthorizedCron } from '@/utils/cron-auth'
import { createAdminClient } from '@/utils/supabase/admin'

// Example scheduled job, and the pattern for every /api/cron/* route: check
// the secret first, then do the work with the service-role client, and return
// counts and errors only, never user content (the response lands in the
// scheduler's logs).
//
// Coolify: Scheduled Tasks → command
//   curl -fsS -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ping

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const refused = rejectUnauthorizedCron(request)
  if (refused) return refused

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('tenants')
    .select('id', { count: 'exact', head: true })
  if (error) return NextResponse.json({ error: 'Could not read tenants' }, { status: 500 })

  return NextResponse.json({ ok: true, tenants: count ?? 0, at: new Date().toISOString() })
}
