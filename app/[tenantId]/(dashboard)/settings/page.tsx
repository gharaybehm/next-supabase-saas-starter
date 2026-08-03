import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import SettingsForms from './SettingsForms'

export const metadata = {
  title: 'Settings',
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: membership } = await db
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/tenants');

  const effectiveRole = membership.role as 'admin' | 'supervisor' | 'worker';

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
    .select('name')
    .eq('id', tenantId)
    .single();

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
      />
    </div>
  )
}
