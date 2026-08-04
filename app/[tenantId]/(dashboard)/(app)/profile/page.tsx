import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getNotificationPrefs } from '@/app/actions/profile';
import { Mail, Calendar } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import NotificationPrefsCard from './NotificationPrefsCard';
import PushSubscribeToggle from './PushSubscribeToggle';
import EditProfileForm from './EditProfileForm';

export const dynamic = 'force-dynamic';

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const [{ data: userProfile }, prefs] = await Promise.all([
    db.from('user_profiles').select('full_name, phone, created_at').eq('id', user.id).single(),
    getNotificationPrefs(),
  ]);

  return (
    <div className="max-w-lg space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-lg font-semibold text-paper">
            {initials(userProfile?.full_name)}
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-ink">{userProfile?.full_name ?? 'User'}</p>
          </div>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted"><Calendar className="h-3.5 w-3.5" /> Member since</span>
            <span className="font-medium text-ink">
              {userProfile?.created_at ? new Date(userProfile.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted"><Mail className="h-3.5 w-3.5" /> Email</span>
            <span className="font-medium text-ink">{user.email}</span>
          </div>
        </div>

        <EditProfileForm
          tenantId={tenantId}
          initialValues={{
            full_name: userProfile?.full_name ?? '',
            phone: userProfile?.phone ?? '',
          }}
        />
      </Card>

      <NotificationPrefsCard tenantId={tenantId} initialPrefs={prefs} />
      <PushSubscribeToggle tenantId={tenantId} />
    </div>
  );
}
