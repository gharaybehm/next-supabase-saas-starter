import { getTranslations } from 'next-intl/server';
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
import AdminPanel from '../AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminManagementPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('admin');

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
      <h1 className="font-heading text-2xl font-bold text-ink">{t('title')}</h1>

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
