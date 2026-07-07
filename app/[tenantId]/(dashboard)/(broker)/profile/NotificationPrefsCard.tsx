'use client';

import { useState, useTransition } from 'react';
import Card from '@/app/components/ui/Card';
import PillSwitch from '@/app/components/ui/PillSwitch';
import { updateNotificationPrefs, type NotificationPrefs } from '@/app/actions/profile';

interface NotificationPrefsCardProps {
  tenantId: string;
  initialPrefs: NotificationPrefs;
}

const ROWS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: 'notify_new_listings', label: 'New listings in my areas' },
  { key: 'notify_deal_updates', label: 'Deal & commission updates' },
  { key: 'notify_monthly_statements', label: 'Monthly commission statements' },
];

export default function NotificationPrefsCard({ tenantId, initialPrefs }: NotificationPrefsCardProps) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [, startTransition] = useTransition();

  function toggle(key: keyof NotificationPrefs, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    startTransition(async () => {
      await updateNotificationPrefs(tenantId, { [key]: value });
    });
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-ink">Notification preferences</h3>
      <div className="space-y-4">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between">
            <span className="text-sm text-ink">{row.label}</span>
            <PillSwitch checked={prefs[row.key]} onChange={(v) => toggle(row.key, v)} label={row.label} />
          </div>
        ))}
      </div>
    </Card>
  );
}
