import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import AdminTopNav from '@/app/components/AdminTopNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
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
  const { data: membership } = await (supabase as any)
    .from('tenant_members')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'admin') redirect(`/${tenantId}/dashboard`);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <AdminTopNav tenantId={tenantId} />
      <main className="flex-1 overflow-y-auto bg-canvas p-4 md:p-6">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
