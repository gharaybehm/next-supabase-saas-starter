'use client';

import { useState, useTransition } from 'react';
import Card from '@/app/components/ui/Card';
import PillSwitch from '@/app/components/ui/PillSwitch';
import { updateNotificationPrefs, type NotificationPrefs } from '@/app/actions/profile';

interface NotificationPrefsCardProps {
  tenantId: string;
  initialPrefs: NotificationPrefs;
}

export default function NotificationPrefsCard({ tenantId, initialPrefs }: NotificationPrefsCardProps) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [, startTransition] = useTransition();

  function toggle(value: boolean) {
    setPrefs((p) => ({ ...p, email_notifications: value }));
    startTransition(async () => {
      await updateNotificationPrefs(tenantId, { email_notifications: value });
    });
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-ink">Notification preferences</h3>
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink">Email notifications</span>
        <PillSwitch checked={prefs.email_notifications} onChange={toggle} label="Email notifications" />
      </div>
    </Card>
  );
}
