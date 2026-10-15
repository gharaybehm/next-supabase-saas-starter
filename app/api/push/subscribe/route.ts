import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireTenantRole } from '@/utils/supabase/tenant-access'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { subscription: PushSubscriptionJSON; tenantId: string; userAgent?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subscription, tenantId, userAgent } = body
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !tenantId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // The write below uses the service-role client, so membership is checked here.
  const gate = await requireTenantRole(tenantId, 'worker')
  if (!gate.ok) {
    return NextResponse.json({ error: 'Not a member of this tenant' }, { status: 403 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('push_subscriptions')
    .upsert(
      {
        user_id: user.id,
        tenant_id: tenantId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
