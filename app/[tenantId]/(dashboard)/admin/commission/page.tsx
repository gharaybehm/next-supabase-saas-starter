import { getTranslations } from 'next-intl/server';
import { getCommissionConfig } from '@/app/actions/listings';
import { updateCommission } from '@/app/actions/admin';
import Card from '@/app/components/ui/Card';
import CommissionStepper from './CommissionStepper';

export const dynamic = 'force-dynamic';

export default async function AdminCommissionPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('admin');
  const commission = await getCommissionConfig(tenantId);

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">{t('nav.commission')}</h1>

      <Card className="mx-auto max-w-[520px]">
        <CommissionStepper
          tenantId={tenantId}
          initialListingPct={commission.listing_pct}
          onUpdate={updateCommission}
        />
        <p className="mt-4 text-xs text-muted">
          Changing this only affects listings created after the change — existing listings keep the split they were created with.
        </p>
      </Card>
    </div>
  );
}
