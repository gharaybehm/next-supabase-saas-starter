import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { Clock } from 'lucide-react';
import Logo from '@/app/components/ui/Logo';
import Card from '@/app/components/ui/Card';
import StepIndicator from '@/app/components/ui/StepIndicator';
import VerifyingCredentialsListener from './VerifyingCredentialsListener';

export const dynamic = 'force-dynamic';

export default async function VerifyingCredentialsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('onboarding.verifying');
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brokerProfile } = await (admin as any)
    .from('broker_profiles')
    .select('dld_verified, rera_card_no, verification_status')
    .eq('id', user.id)
    .single();

  if (brokerProfile?.dld_verified) {
    redirect(`/${tenantId}/pending-agreement`);
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-canvas p-4 py-12">
      <div className="w-full max-w-[900px]">
        <div className="mb-6 flex flex-col items-center gap-6">
          <Logo size={30} arabicLine />
          <StepIndicator step={2} />
        </div>

        <Card className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-status-pending-bg)]">
            <Clock className="h-8 w-8 text-[color:var(--color-status-pending)]" />
          </div>
          <h1 className="font-heading text-xl font-bold text-ink">{t('title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('subtitle')}</p>

          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-canvas px-5 py-3 text-sm text-ink">
            <span>{brokerProfile?.rera_card_no}</span>
            <span className="rounded-full bg-[color:var(--color-status-pending-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--color-status-pending)]">
              {t('pendingReview')}
            </span>
          </div>

          <VerifyingCredentialsListener userId={user.id} tenantId={tenantId} />
        </Card>
      </div>
    </div>
  );
}
