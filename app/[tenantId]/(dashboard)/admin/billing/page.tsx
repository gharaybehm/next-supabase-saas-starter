import { getTranslations } from 'next-intl/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getAuditLogs } from '@/app/actions/admin';
import Card from '@/app/components/ui/Card';
import ManageBillingButton from '../../../billing/ManageBillingButton';
import SubscribeButton from '../../../billing/SubscribeButton';

export const dynamic = 'force-dynamic';

const BILLING_ACTIONS = ['commission_updated', 'broker_dld_verified', 'broker_dld_unverified', 'broker_rejected', 'agreement_sent'];

export default async function AdminBillingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('billing');
  const admin = createAdminClient();

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

  const bannerTone =
    status === 'active' ? 'active' : inGrace ? 'pending' : 'rejected';

  const auditLogs = await getAuditLogs(tenantId);
  const billingLogs = auditLogs.filter((log: { action: string }) => BILLING_ACTIONS.includes(log.action));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold text-ink">Tenant billing</h1>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Plan</p>
          <p className="mt-1 font-heading text-lg font-bold text-ink">Rabita Community — Flat Monthly</p>

          <div
            className={`mt-4 rounded-xl px-4 py-3 text-sm ${
              bannerTone === 'active'
                ? 'bg-[color:var(--color-status-active-bg)] text-[color:var(--color-status-active)]'
                : bannerTone === 'pending'
                  ? 'bg-[color:var(--color-status-pending-bg)] text-[color:var(--color-status-pending)]'
                  : 'bg-[color:var(--color-status-rejected-bg)] text-[color:var(--color-status-rejected)]'
            }`}
          >
            {status === 'active' && subscription?.current_period_end &&
              `Active — next charge ${new Date(subscription.current_period_end).toLocaleDateString()}`}
            {inGrace && subscription?.grace_period_ends_at &&
              `Grace period — access continues uninterrupted until ${new Date(subscription.grace_period_ends_at).toLocaleDateString()}`}
            {status !== 'active' && !inGrace &&
              'Blocked — all members redirected to billing except you'}
          </div>

          <div className="mt-5">
            {status === 'active' || status === 'past_due' ? (
              <ManageBillingButton tenantId={tenantId} label={t('manageButton')} />
            ) : (
              <SubscribeButton tenantId={tenantId} label={t('subscribeButton')} />
            )}
          </div>
        </Card>

        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Audit log</p>
          <div className="space-y-3">
            {billingLogs.length === 0 && <p className="text-sm text-muted">No billing events yet.</p>}
            {billingLogs.map((log: { id: string; action: string; created_at: string }) => (
              <div key={log.id} className="flex items-center justify-between text-sm">
                <span className="text-ink">{log.action.replace(/_/g, ' ')}</span>
                <span className="text-muted">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Blocked-member preview</p>
        <div className="overflow-hidden rounded-2xl bg-ink p-8 text-center text-paper">
          <p className="font-wordmark text-lg font-extrabold">Rabita</p>
          <p className="mt-4 text-sm text-paper/70">Subscription paused</p>
          <button className="mt-6 rounded-full bg-terracotta-on-dark px-5 py-2 text-sm font-semibold text-white">
            Contact admin
          </button>
        </div>
      </div>
    </div>
  );
}
