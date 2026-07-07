import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { CreditCard } from 'lucide-react';
import SubscribeButton from './SubscribeButton';
import ManageBillingButton from './ManageBillingButton';

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('billing');
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/tenants');
  const isAdmin = membership.role === 'admin';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscription } = await (admin as any)
    .from('subscriptions')
    .select('status, current_period_end, grace_period_ends_at')
    .eq('tenant_id', tenantId)
    .single();

  const status: string = subscription?.status ?? 'incomplete';
  const inGrace =
    status === 'past_due' &&
    subscription?.grace_period_ends_at &&
    new Date(subscription.grace_period_ends_at) > new Date();

  const isBlocked = status !== 'active' && !inGrace;

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    past_due: 'bg-amber-50 text-amber-700',
    canceled: 'bg-zinc-100 text-zinc-600',
    unpaid: 'bg-red-50 text-red-700',
    incomplete: 'bg-zinc-100 text-zinc-600',
  };

  return (
    <div className="flex h-full min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <CreditCard className="h-8 w-8 text-amber-600" />
      </div>

      <h1 className="text-2xl font-semibold text-zinc-900">
        {isBlocked ? (status === 'past_due' || status === 'unpaid' ? t('pastDueTitle') : t('setupTitle')) : t('title')}
      </h1>
      <p className="mt-3 max-w-md text-sm text-zinc-500 leading-relaxed">
        {isBlocked
          ? (status === 'past_due' || status === 'unpaid' ? t('pastDueSubtitle') : t('setupSubtitle'))
          : ''}
      </p>

      <div className="mt-6 flex items-center gap-2 rounded-xl bg-zinc-50 px-5 py-3 ring-1 ring-zinc-200 text-sm text-zinc-600">
        <span className="text-zinc-400">{t('title')}:</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status]}`}>
          {t(`status.${status}`)}
        </span>
      </div>

      {inGrace && subscription?.grace_period_ends_at && (
        <p className="mt-4 max-w-md text-xs text-amber-600">
          {t('graceNotice', { date: new Date(subscription.grace_period_ends_at).toLocaleDateString() })}
        </p>
      )}

      {status === 'active' && subscription?.current_period_end && (
        <p className="mt-4 text-xs text-zinc-400">
          {t('renewsOn')} {new Date(subscription.current_period_end).toLocaleDateString()}
        </p>
      )}

      {isAdmin ? (
        <div className="mt-8">
          {status === 'active' || status === 'past_due' ? (
            <ManageBillingButton tenantId={tenantId} label={t('manageButton')} />
          ) : (
            <SubscribeButton tenantId={tenantId} label={t('subscribeButton')} />
          )}
        </div>
      ) : (
        isBlocked && (
          <p className="mt-8 max-w-md text-sm text-zinc-500">{t('adminOnlyNotice')}</p>
        )
      )}
    </div>
  );
}
