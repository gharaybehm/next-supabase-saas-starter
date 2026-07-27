import webPush from 'web-push'
import { createAdminClient } from '@/utils/supabase/admin'

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
  tag?: string
}

// Configured once at module load — this file is server-only.
webPush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

type PushSubRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushToTenant(tenantId: string, payload: PushPayload): Promise<void> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (admin as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)

  await deliver(admin, subs, payload)
}

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subs } = await (admin as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  await deliver(admin, subs, payload)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deliver(admin: any, subs: PushSubRow[] | null, payload: PushPayload): Promise<void> {
  if (!subs || subs.length === 0) return

  // Expo device tokens are stored in the same push_subscriptions table as
  // browser Web Push endpoints (endpoint = 'ExponentPushToken[...]',
  // auth/p256dh = 'expo') — split by endpoint shape and deliver each via its
  // own transport.
  const webSubs = subs.filter((sub) => !sub.endpoint.startsWith('ExponentPushToken'))
  const expoSubs = subs.filter((sub) => sub.endpoint.startsWith('ExponentPushToken'))

  if (webSubs.length > 0 && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon ?? '/icon.png',
      badge: payload.badge ?? '/icon.png',
      url: payload.url ?? '/',
      tag: payload.tag,
    })

    const staleIds: string[] = []

    await Promise.allSettled(
      webSubs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            notification
          )
        } catch (err: unknown) {
          const status = (err as { statusCode?: number }).statusCode
          if (status === 410 || status === 404) {
            staleIds.push(sub.id)
          }
        }
      })
    )

    if (staleIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any)
        .from('push_subscriptions')
        .delete()
        .in('id', staleIds)
    }
  }

  if (expoSubs.length > 0) {
    const messages = expoSubs.map((sub) => ({
      to: sub.endpoint,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: { url: payload.url },
    }))

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      })
    } catch (err) {
      console.error('[expo-push] delivery error:', err)
    }
  }
}
