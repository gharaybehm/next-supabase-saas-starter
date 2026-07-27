import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validateInviteToken, registerViaTnvite, registerViaTeamInvite } from '@/app/actions/invitations';
import { isDldLicenseGateDisabled } from '@/utils/testingFlags';
import { AlertCircle } from 'lucide-react';
import Logo from '@/app/components/ui/Logo';
import Card from '@/app/components/ui/Card';
import StepIndicator from '@/app/components/ui/StepIndicator';
import { Input, Label } from '@/app/components/ui/fields';

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: submitError } = await searchParams;
  const t = await getTranslations('auth.invite');

  const { valid, email, error: tokenError, inviteType, brokerageName } = await validateInviteToken(token);
  const isTeamInvite = inviteType === 'team';

  if (!valid) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas p-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-status-rejected-bg)]">
            <AlertCircle className="h-7 w-7 text-[color:var(--color-status-rejected)]" />
          </div>
          <h1 className="font-heading text-xl font-bold text-ink">{t('invalidToken')}</h1>
          <p className="mt-2 text-sm text-muted">{tokenError}</p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            {t('signIn')}
          </a>
        </div>
      </div>
    );
  }

  async function handleRegister(formData: FormData) {
    'use server';
    formData.set('token', token);
    const result = isTeamInvite
      ? await registerViaTeamInvite(formData)
      : await registerViaTnvite(formData);
    if (result.error) {
      redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/${result.tenantId}/verifying-credentials`);
  }

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto bg-canvas p-4 py-12">
      <div className="w-full max-w-[900px]">
        <div className="mb-6 flex flex-col items-center gap-6">
          <Logo size={30} arabicLine />
          <StepIndicator step={1} />
        </div>

        <Card className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <h2 className="font-heading text-2xl font-bold text-ink">{t('title')}</h2>
            <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
          </div>

          {isTeamInvite && (
            <div className="mb-6 rounded-xl bg-terracotta/10 px-4 py-3 text-center text-sm font-medium text-terracotta">
              {t('teamInviteBanner', { brokerageName: brokerageName ?? '' })}
            </div>
          )}

          {submitError && (
            <div className="mb-6 flex items-start gap-2 rounded-xl bg-[color:var(--color-status-rejected-bg)] px-4 py-3 text-sm text-[color:var(--color-status-rejected)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form action={handleRegister} className="space-y-5">
            <div>
              <Label>{t('fullNameLabel')}</Label>
              <Input name="full_name" type="text" required autoFocus placeholder={t('fullNamePlaceholder')} />
            </div>

            <div>
              <Label>{t('emailLabel')}</Label>
              <Input name="email" type="email" required defaultValue={email} />
            </div>

            <div>
              <Label>{t('passwordLabel')}</Label>
              <Input name="password" type="password" required minLength={8} placeholder="••••••••" />
              <p className="mt-1 text-xs text-muted">{t('passwordHint')}</p>
            </div>

            <hr className="border-ink/10" />

            <div>
              <Label>{t('reraCardLabel')}</Label>
              <Input name="rera_card_no" type="text" required placeholder={t('reraCardPlaceholder')} />
            </div>

            <div>
              <Label>{t('dldLicenseLabel')}</Label>
              <Input name="dld_license_file" type="file" accept="application/pdf,image/jpeg,image/png" required={!isDldLicenseGateDisabled()} />
              <p className="mt-1 text-xs text-muted">{t('dldLicenseHint')}</p>
            </div>

            {!isTeamInvite && (
              <>
                <div>
                  <Label>{t('brokerageLabel')}</Label>
                  <Input name="brokerage_name" type="text" required placeholder={t('brokeragePlaceholder')} />
                </div>

                <div>
                  <Label>{t('tradeLicenseLabel')}</Label>
                  <Input name="trade_license_no" type="text" placeholder={t('tradeLicensePlaceholder')} />
                </div>
              </>
            )}

            <p className="text-xs leading-relaxed text-muted">{t('agreementNotice')}</p>

            <button
              type="submit"
              className="w-full rounded-full bg-terracotta px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {t('submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            {t('alreadyMember')}{' '}
            <a href="/login" className="font-semibold text-terracotta hover:opacity-80">
              {t('signIn')}
            </a>
          </p>
        </Card>
      </div>
    </div>
  );
}
