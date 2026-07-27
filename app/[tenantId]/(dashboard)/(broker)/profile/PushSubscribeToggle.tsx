'use client';

import { useEffect, useState } from 'react';
import Card from '@/app/components/ui/Card';
import PillSwitch from '@/app/components/ui/PillSwitch';
import { subscribeToPush, unsubscribeFromPush } from '@/app/components/ServiceWorkerRegistration';

interface PushSubscribeToggleProps {
  tenantId: string;
}

export default function PushSubscribeToggle({ tenantId }: PushSubscribeToggleProps) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled) return;
      setSupported(true);
      setSubscribed(!!sub && Notification.permission === 'granted');
    }

    check().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    const ok = next ? await subscribeToPush(tenantId) : await unsubscribeFromPush();
    if (ok) setSubscribed(next);
    setBusy(false);
  }

  if (!supported) return null;

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-ink">Push notifications</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink">Enable browser push notifications</span>
        <PillSwitch
          checked={subscribed}
          onChange={toggle}
          disabled={busy}
          label="Enable browser push notifications"
        />
      </div>
    </Card>
  );
}
