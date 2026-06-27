import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { validateInviteToken, registerViaTnvite } from '@/app/actions/invitations';
import { AlertCircle, Building2, CreditCard, Lock, Mail, User } from 'lucide-react';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations('auth.invite');
  const tAuth = await getTranslations('auth.login');

  const { valid, email, error: tokenError } = await validateInviteToken(token);

  if (!valid) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-50 p-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-7 w-7 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">{t('invalidToken')}</h1>
          <p className="mt-2 text-sm text-zinc-500">{tokenError}</p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
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
    const result = await registerViaTnvite(formData);
    if (result.error) {
      redirect(`/invite/${token}?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/${result.tenantId}/pending-agreement`);
  }

  return (
    <div className="flex h-full overflow-hidden bg-white">
      {/* Left branding panel */}
      <div className="relative hidden w-1/2 lg:flex lg:flex-col lg:justify-between p-12 overflow-hidden bg-brand-900">
        <div className="absolute inset-0 bg-gradient-to-t from-brand-950/90 via-brand-900/50 to-transparent" />
        <div className="relative z-10">
          <span className="text-2xl font-bold text-white tracking-tight">Micro MLS</span>
        </div>
        <div className="relative z-10 max-w-lg pb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl leading-tight">
            {tAuth('tagline')}
          </h1>
          <p className="mt-6 text-lg text-brand-100/80 leading-relaxed font-light">
            {tAuth('taglineSubtitle')}
          </p>
        </div>
      </div>

      {/* Right registration form */}
      <div className="flex w-full flex-col overflow-y-auto px-4 py-12 sm:px-6 lg:w-1/2 lg:px-20 lg:justify-center xl:px-32 bg-zinc-50">
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">{t('title')}</h2>
            <p className="mt-2 text-sm text-zinc-500">{t('subtitle')}</p>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200/50">
            <form action={handleRegister} className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('fullNameLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                    <User className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    name="full_name" type="text" required autoFocus
                    placeholder={t('fullNamePlaceholder')}
                    className="block w-full rounded-xl border-0 py-2.5 ps-10 pe-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                  />
                </div>
              </div>

              {/* Email (pre-filled from invite) */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('emailLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                    <Mail className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    name="email" type="email" required
                    defaultValue={email}
                    className="block w-full rounded-xl border-0 py-2.5 ps-10 pe-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('passwordLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                    <Lock className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    name="password" type="password" required minLength={8}
                    placeholder="••••••••"
                    className="block w-full rounded-xl border-0 py-2.5 ps-10 pe-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-400">{t('passwordHint')}</p>
              </div>

              <hr className="border-zinc-100" />

              {/* RERA Card */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('reraCardLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                    <CreditCard className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    name="rera_card_no" type="text" required
                    placeholder={t('reraCardPlaceholder')}
                    className="block w-full rounded-xl border-0 py-2.5 ps-10 pe-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                  />
                </div>
              </div>

              {/* Brokerage */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('brokerageLabel')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  </div>
                  <input
                    name="brokerage_name" type="text" required
                    placeholder={t('brokeragePlaceholder')}
                    className="block w-full rounded-xl border-0 py-2.5 ps-10 pe-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                  />
                </div>
              </div>

              {/* Trade License (optional) */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  {t('tradeLicenseLabel')}
                </label>
                <input
                  name="trade_license_no" type="text"
                  placeholder={t('tradeLicensePlaceholder')}
                  className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
                />
              </div>

              {/* Agreement notice */}
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('agreementNotice')}
              </p>

              <button
                type="submit"
                className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors"
              >
                {t('submit')}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              {t('alreadyMember')}{' '}
              <a href="/login" className="font-medium text-brand-600 hover:text-brand-500">
                {t('signIn')}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
