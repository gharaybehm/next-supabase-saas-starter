import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import TenantPicker from '@/app/components/tenants/TenantPicker';
import { getTenants } from '@/app/actions/tenants';

export const metadata = {
  title: 'Your Workspaces',
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect('/login');

  const tenants = await getTenants();

  // Single tenant: skip the picker and go straight in
  if (tenants.length === 1) {
    redirect(`/${tenants[0].id}/dashboard`);
  }

  return <TenantPicker tenants={tenants} />;
}
