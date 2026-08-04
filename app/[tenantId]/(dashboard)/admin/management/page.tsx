import { getTranslations } from 'next-intl/server';
import {
  getAdminMembers,
  getAuditLogs,
  getApiKeys,
  getAdminInvitations,
  removeMember,
  generateApiKey,
  revokeApiKey,
} from '@/app/actions/admin';
import { generateInviteLink } from '@/app/actions/invitations';
import AdminPanel from '../AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminManagementPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('admin');

  const [members, auditLogs, apiKeys, invitations] = await Promise.all([
    getAdminMembers(tenantId),
    getAuditLogs(tenantId),
    getApiKeys(tenantId),
    getAdminInvitations(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">{t('title')}</h1>

      <AdminPanel
        tenantId={tenantId}
        members={members}
        auditLogs={auditLogs}
        apiKeys={apiKeys}
        invitations={invitations}
        onRemoveMember={removeMember}
        onGenerateInvite={generateInviteLink}
        onGenerateApiKey={generateApiKey}
        onRevokeApiKey={revokeApiKey}
      />
    </div>
  );
}
