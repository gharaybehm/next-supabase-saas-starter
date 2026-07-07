import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { PartyPopper } from 'lucide-react';
import Link from 'next/link';
import Logo from '@/app/components/ui/Logo';
import Card from '@/app/components/ui/Card';
import StepIndicator from '@/app/components/ui/StepIndicator';

export const dynamic = 'force-dynamic';

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('onboarding.welcome');
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreement } = await (admin as any)
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (agreement?.status !== 'signed') {
    redirect(`/${tenantId}/pending-agreement`);
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-canvas p-4 py-12">
      <div className="w-full max-w-[900px]">
        <div className="mb-6 flex flex-col items-center gap-6">
          <Logo size={30} arabicLine />
          <StepIndicator step={4} />
        </div>

        <Card className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-status-active-bg)]">
            <PartyPopper className="h-8 w-8 text-[color:var(--color-status-active)]" />
          </div>
          <h1 className="font-heading text-xl font-bold text-ink">{t('title')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('subtitle')}</p>

          <Link
            href={`/${tenantId}/listings`}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {t('cta')}
          </Link>
        </Card>
      </div>
    </div>
  );
}
