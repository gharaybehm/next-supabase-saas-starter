import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { FileSignature, Mail, Check } from 'lucide-react';
import Logo from '@/app/components/ui/Logo';
import Card from '@/app/components/ui/Card';
import StepIndicator from '@/app/components/ui/StepIndicator';

export const dynamic = 'force-dynamic';

function TrackerStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
          done
            ? 'bg-[color:var(--color-status-active)] text-white'
            : active
              ? 'bg-[color:var(--color-status-pending-bg)] text-[color:var(--color-status-pending)]'
              : 'bg-ink/10 text-muted'
        }`}
      >
        {done ? <Check className="h-3 w-3" /> : ''}
      </span>
      <span className={`text-xs font-medium ${done || active ? 'text-ink' : 'text-muted'}`}>{label}</span>
    </div>
  );
}

export default async function PendingAgreementPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('agreement');
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

  if (agreement?.status === 'signed') {
    redirect(`/${tenantId}/welcome`);
  }

  const status = agreement?.status ?? 'sent';

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-canvas p-4 py-12">
      <div className="w-full max-w-[900px]">
        <div className="mb-6 flex flex-col items-center gap-6">
          <Logo size={30} arabicLine />
          <StepIndicator step={3} />
        </div>

        <Card className="mx-auto max-w-lg text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-status-pending-bg)]">
            <FileSignature className="h-8 w-8 text-[color:var(--color-status-pending)]" />
          </div>
          <h1 className="font-heading text-xl font-bold text-ink">{t('pendingTitle')}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t('pendingSubtitle')}</p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-canvas px-5 py-3 text-sm text-ink">
            <Mail className="h-4 w-4 text-muted" />
            <span className="text-muted">{t('sentTo')}</span>
            <strong>{user.email}</strong>
          </div>

          <div className="mt-6 flex items-center justify-center gap-6">
            <TrackerStep label={t('status.sent')} done={status !== 'sent'} active={status === 'sent'} />
            <TrackerStep label={t('status.viewed')} done={status === 'signed'} active={status === 'viewed'} />
            <TrackerStep label={t('status.awaitingSignature')} done={false} active={status === 'viewed' || status === 'sent'} />
          </div>

          <form
            action={async () => {
              'use server';
              const { resendAgreement: resend } = await import('@/utils/dropboxsign');
              const db = createAdminClient() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
              const { data: agr } = await db
                .from('agreements')
                .select('signature_request_id')
                .eq('broker_id', user!.id)
                .single();

              if (agr?.signature_request_id) {
                await resend(agr.signature_request_id);
              }
            }}
            className="mt-8"
          >
            <button
              type="submit"
              className="rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {t('resendButton')}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
