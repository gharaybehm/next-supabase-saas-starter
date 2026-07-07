import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { requireActiveSubscription } from "@/utils/requireSubscription";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: membership } = await db.from("tenant_members")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .single();

  if (!membership) redirect("/tenants");

  const { data: tenant } = await db.from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  if (!tenant) redirect("/tenants");

  await requireActiveSubscription(tenantId);

  return <>{children}</>;
}
