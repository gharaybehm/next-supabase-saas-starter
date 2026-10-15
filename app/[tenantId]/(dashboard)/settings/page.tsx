import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import SettingsForms, { type BillingInfo } from './SettingsForms'
import { getTenantActor } from '@/utils/supabase/tenant-access'
import { getCurrentUser } from '@/utils/supabase/current-user'
import { createAdminClient } from '@/utils/supabase/admin'
import { isStripeConfigured } from '@/utils/stripe'
import { hasLiveSubscription } from '@/utils/supabase/org-types'

export const metadata = {
  title: 'Settings',
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const actor = await getTenantActor(tenantId);
  if (!actor) redirect('/tenants');

  const effectiveRole = actor.role;

  if (effectiveRole === 'worker') {
    redirect(`/${tenantId}/dashboard`);
  }

  const profileData = {
    email: user.email || '',
    full_name: user.user_metadata?.full_name || '',
    phone: user.user_metadata?.phone || '',
  };

  // Members of this tenant, joined with user_profiles for name/phone
  const { data: memberRows = [] } = await db
    .from('tenant_members')
    .select('user_id, role')
    .eq('tenant_id', tenantId);

  const memberRoleById = new Map(
    (memberRows as { user_id: string; role: 'admin' | 'supervisor' | 'worker' }[]).map(m => [m.user_id, m.role])
  );
  const memberIds = Array.from(memberRoleById.keys());

  const { data: profilesForMembers = [] } = memberIds.length > 0
    ? await db
        .from('user_profiles')
        .select('id, full_name, phone, created_at')
        .in('id', memberIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const allMembers = (profilesForMembers as { id: string; full_name: string | null; phone: string | null; created_at: string }[])
    .map(p => ({ ...p, role: memberRoleById.get(p.id) ?? 'worker' }));

  const { data: tenant } = await db
    .from('tenants')
    .select('name, organization_id')
    .eq('id', tenantId)
    .single();

  // Billing belongs to the tenant's organization. RLS returns it only to that
  // organization's members; the seat count needs every tenant of the
  // organization, including ones this user is not in, so it is read with the
  // service-role client once membership is known.
  let billing: BillingInfo | null = null;
  if (effectiveRole === 'admin' && tenant?.organization_id) {
    const { data: org } = await db
      .from('organizations')
      .select('id, name, subscription_status, tenant_seats, stripe_subscription_id')
      .eq('id', tenant.organization_id)
      .maybeSingle();
    if (org) {
      const { data: me } = await db
        .from('organization_members')
        .select('role')
        .eq('organization_id', org.id)
        .eq('user_id', user.id)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (createAdminClient() as any)
        .from('tenants')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', org.id);
      billing = {
        organizationId: org.id,
        organizationName: org.name,
        status: org.subscription_status,
        seats: org.tenant_seats,
        used: count ?? 0,
        isOwner: me?.role === 'owner',
        hasSubscription: hasLiveSubscription(org),
        configured: isStripeConfigured(),
      };
    }
  }

  const t = await getTranslations('settings');

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('description')}</p>
      </div>

      <SettingsForms
        initialProfile={profileData}
        currentUserId={user.id}
        userRole={effectiveRole}
        allMembers={allMembers}
        tenantId={tenantId}
        tenantName={tenant?.name ?? ''}
        billing={billing}
      />
    </div>
  )
}
