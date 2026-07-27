import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getNotificationPrefs, isLicenseRenewalDue } from '@/app/actions/profile';
import { Download, Mail, Calendar } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import StatusBadge from '@/app/components/ui/StatusBadge';
import NotificationPrefsCard from './NotificationPrefsCard';
import PushSubscribeToggle from './PushSubscribeToggle';
import EditProfileForm from './EditProfileForm';
import RenewLicenseCard from './RenewLicenseCard';

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

  const [{ data: userProfile }, { data: brokerProfile }, { data: agreement }, prefs, renewalDue] = await Promise.all([
    db.from('user_profiles').select('full_name, phone, created_at').eq('id', user.id).single(),
    db.from('broker_profiles').select('rera_card_no, brokerage_name, dld_verified').eq('id', user.id).single(),
    db.from('agreements').select('status, signed_at').eq('broker_id', user.id).eq('tenant_id', tenantId).single(),
    getNotificationPrefs(),
    isLicenseRenewalDue(tenantId),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        {renewalDue && <RenewLicenseCard tenantId={tenantId} />}

        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-lg font-semibold text-paper">
              {initials(userProfile?.full_name)}
            </div>
            <div>
              <p className="font-heading text-lg font-bold text-ink">{userProfile?.full_name ?? 'Broker'}</p>
              <p className="text-sm text-muted">{brokerProfile?.brokerage_name}</p>
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
              rera_card_no: brokerProfile?.rera_card_no ?? '',
            }}
          />
        </Card>

        <NotificationPrefsCard tenantId={tenantId} initialPrefs={prefs} />
        <PushSubscribeToggle tenantId={tenantId} />
      </div>

      <div>
        <Card>
          <h3 className="mb-4 text-sm font-semibold text-ink">Master Co-Brokerage Agreement</h3>
          <div className="flex items-center justify-between">
            <StatusBadge status={agreement?.status === 'signed' ? 'verified' : 'pending'} label={agreement?.status ?? 'pending'} />
            {agreement?.signed_at && (
              <span className="text-xs text-muted">Signed {new Date(agreement.signed_at).toLocaleDateString()}</span>
            )}
          </div>

          {agreement?.status === 'signed' ? (
            <a
              href={`/api/${tenantId}/agreement-pdf`}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              <Download className="h-4 w-4" />
              Download signed PDF
            </a>
          ) : (
            <p className="mt-4 text-sm text-muted">Your agreement isn&apos;t signed yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
