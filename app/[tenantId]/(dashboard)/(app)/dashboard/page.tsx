import { createClient } from '@/utils/supabase/server';
import Card from '@/app/components/ui/Card';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('full_name')
    .eq('id', user?.id)
    .single();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">
        Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
      </h1>
      <Card>
        <p className="text-sm text-muted">
          This is your app&apos;s dashboard. Replace this placeholder with the
          widgets, stats, or content specific to your product.
        </p>
      </Card>
    </div>
  );
}
