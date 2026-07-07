import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import Logo from '@/app/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function BillingBlockedPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
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

  if (membership?.role === 'admin') redirect(`/${tenantId}/billing`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: subscription } = await (admin as any)
    .from('subscriptions')
    .select('status')
    .eq('tenant_id', tenantId)
    .single();

  if (subscription?.status === 'active') redirect(`/${tenantId}/dashboard`);

  return (
    <div className="flex h-full items-center justify-center bg-ink p-4">
      <div className="w-full max-w-sm rounded-2xl bg-ink p-10 text-center">
        <Logo variant="dark" size={28} className="mx-auto" />
        <p className="mt-8 text-sm font-semibold uppercase tracking-wide text-paper/60">Subscription paused</p>
        <p className="mt-3 text-sm leading-relaxed text-paper/80">
          Your community&apos;s subscription needs attention. Please contact your tenant admin to restore access.
        </p>
        <button
          disabled
          className="mt-8 w-full rounded-full bg-terracotta-on-dark px-5 py-2.5 text-sm font-semibold text-white opacity-90"
        >
          Contact admin
        </button>
      </div>
    </div>
  );
}
