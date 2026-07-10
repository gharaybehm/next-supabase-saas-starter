import { getTranslations } from 'next-intl/server';
import { getAdminMembers, verifyBroker, rejectBroker, getBrokerLicenseUrl } from '@/app/actions/admin';
import Card from '@/app/components/ui/Card';
import VerificationRow from './VerificationRow';

export const dynamic = 'force-dynamic';

interface MemberRow {
  user_id: string;
  created_at: string;
  user_profiles: { full_name: string } | null;
  broker_profiles: {
    rera_card_no: string;
    brokerage_name: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    dld_license_path: string | null;
  } | null;
}

export default async function AdminVerificationPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('admin');
  const members: MemberRow[] = await getAdminMembers(tenantId);
  const brokers = members.filter((m) => m.broker_profiles);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">{t('nav.verification')}</h1>

      <Card padding="none" className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-start text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-3 text-start">{t('members.columns.name')}</th>
              <th className="px-5 py-3 text-start">{t('members.columns.brokerage')}</th>
              <th className="px-5 py-3 text-start">{t('members.columns.rera')}</th>
              <th className="px-5 py-3 text-start">{t('members.columns.joined')}</th>
              <th className="px-5 py-3 text-start">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {brokers.map((m) => (
              <VerificationRow
                key={m.user_id}
                tenantId={tenantId}
                userId={m.user_id}
                name={m.user_profiles?.full_name ?? '—'}
                brokerage={m.broker_profiles?.brokerage_name ?? '—'}
                rera={m.broker_profiles?.rera_card_no ?? '—'}
                joined={m.created_at}
                status={m.broker_profiles?.verification_status ?? 'pending'}
                hasLicense={Boolean(m.broker_profiles?.dld_license_path)}
                onApprove={verifyBroker}
                onReject={rejectBroker}
                onViewLicense={getBrokerLicenseUrl}
              />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
