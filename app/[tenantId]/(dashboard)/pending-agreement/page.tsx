import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { FileSignature, Mail } from 'lucide-react';

export const dynamic = 'force-dynamic';

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
    redirect(`/${tenantId}/dashboard`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <FileSignature className="h-8 w-8 text-amber-600" />
      </div>
      <h1 className="text-2xl font-semibold text-zinc-900">{t('pendingTitle')}</h1>
      <p className="mt-3 max-w-md text-sm text-zinc-500 leading-relaxed">{t('pendingSubtitle')}</p>

      <div className="mt-6 flex items-center gap-2 rounded-xl bg-zinc-50 px-5 py-3 ring-1 ring-zinc-200 text-sm text-zinc-600">
        <Mail className="h-4 w-4 text-zinc-400" />
        <span>{t('sentTo')}</span>
        <strong className="text-zinc-900">{user.email}</strong>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="text-zinc-400">{t('status.sent')}:</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
          agreement?.status === 'viewed'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-amber-50 text-amber-700'
        }`}>
          {agreement?.status === 'viewed' ? t('status.viewed') : t('status.sent')}
        </span>
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
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {t('resendButton')}
        </button>
      </form>
    </div>
  );
}
