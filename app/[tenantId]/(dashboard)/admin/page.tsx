import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import {
  getAdminMembers,
  getAuditLogs,
  getApiKeys,
  getAdminListings,
  getAdminInvitations,
  updateCommission,
  verifyBroker,
  removeMember,
  generateApiKey,
  revokeApiKey,
} from '@/app/actions/admin';
import { generateInviteLink } from '@/app/actions/invitations';
import { getCommissionConfig } from '@/app/actions/listings';
import AdminPanel from './AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('admin');
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') redirect(`/${tenantId}/dashboard`);

  const [members, auditLogs, apiKeys, adminListings, invitations, commission] = await Promise.all([
    getAdminMembers(tenantId),
    getAuditLogs(tenantId),
    getApiKeys(tenantId),
    getAdminListings(tenantId),
    getAdminInvitations(tenantId),
    getCommissionConfig(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{t('title')}</h1>
      </div>

      <AdminPanel
        tenantId={tenantId}
        members={members}
        auditLogs={auditLogs}
        apiKeys={apiKeys}
        listings={adminListings}
        invitations={invitations}
        commission={commission}
        onVerifyBroker={verifyBroker}
        onRemoveMember={removeMember}
        onUpdateCommission={updateCommission}
        onGenerateInvite={generateInviteLink}
        onGenerateApiKey={generateApiKey}
        onRevokeApiKey={revokeApiKey}
      />
    </div>
  );
}
