import AppTopNav from '@/app/components/AppTopNav';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { getTenants } from '@/app/actions/tenants';

export const dynamic = 'force-dynamic';

function getInitials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }
  if (email) return email.substring(0, 2).toUpperCase();
  return 'U';
}

export default async function BrokerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  let { data: profile } = await db
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  if (!profile) {
    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || 'User';
    const defaultProfile = {
      id: user.id,
      full_name: fullName,
      phone: user.user_metadata?.phone || null,
      role: 'worker' as const,
    };
    const { data: newProfile } = await db.from('user_profiles').insert(defaultProfile).select().single();
    profile = newProfile ?? defaultProfile;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreement } = await (createAdminClient() as any)
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  const allTenants = await getTenants();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AppTopNav
        tenantId={tenantId}
        agreementSigned={agreement?.status === 'signed'}
        userInitials={getInitials(profile?.full_name, user.email)}
        tenants={allTenants}
      />
      <main className="flex-1 overflow-y-auto bg-canvas p-4 md:p-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
