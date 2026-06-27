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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agreement } = await (createAdminClient() as any)
    .from('agreements')
    .select('status')
    .eq('broker_id', user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (agreement?.status !== 'signed') {
    redirect(`/${tenantId}/pending-agreement`);
  }
}
