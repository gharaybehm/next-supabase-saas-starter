import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function requireActiveSubscription(tenantId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscription } = await (createAdminClient() as any)
    .from('subscriptions')
    .select('status, grace_period_ends_at')
    .eq('tenant_id', tenantId)
    .single();

  const blocked = () => {
    if (!subscription) return true;
    if (subscription.status === 'active') return false;
    if (
      subscription.status === 'past_due' &&
      subscription.grace_period_ends_at &&
      new Date(subscription.grace_period_ends_at) > new Date()
    ) {
      return false;
    }
    return true;
  };

  if (!blocked()) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user?.id)
    .single();

  if (membership?.role === 'admin') {
    redirect(`/${tenantId}/billing`);
  }

  redirect(`/${tenantId}/billing-blocked`);
}
