import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function requireSignedAgreement(tenantId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  // Admins are exempt from agreement requirement
  if (membership?.role === 'admin') return;

  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: brokerProfile } = await db
    .from('broker_profiles')
    .select('dld_verified')
    .eq('id', user.id)
    .single();

  if (!brokerProfile?.dld_verified) {
    redirect(`/${tenantId}/verifying-credentials`);
  }

  const { data: agreement } = await db
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (agreement?.status !== 'signed') {
    redirect(`/${tenantId}/pending-agreement`);
  }
}
