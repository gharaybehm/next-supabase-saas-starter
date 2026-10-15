import Sidebar from "@/app/components/Sidebar";
import TopNav from "@/app/components/TopNav";
import BottomNav from "@/app/components/BottomNav";
import TenantTabs from "@/app/components/tenants/TenantTabs";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTenants } from "@/app/actions/tenants";
import { getTenantActor } from "@/utils/supabase/tenant-access";
import { getCurrentUser } from "@/utils/supabase/current-user";

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  // Membership is checked here for the whole tenant area; each server action
  // and route handler checks again with requireTenantRole.
  const actor = await getTenantActor(tenantId);
  if (!actor) redirect("/tenants");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: tenant } = await db.from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  if (!tenant) redirect("/tenants");

  // The profile is made by the on_auth_user_created trigger; the auth metadata
  // name covers a profile that is missing or has no name.
  const { data: profile } = await db
    .from("user_profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName: string = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "";

  const effectiveRole = actor.role;

  const allTenants = await getTenants();

  return (
    <>
      <Sidebar
        userEmail={user.email}
        userName={displayName}
        userRole={effectiveRole}
        tenantId={tenantId}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav tenantId={tenantId} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pb-6 md:pr-14">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
        <BottomNav userRole={effectiveRole} tenantId={tenantId} tenants={allTenants} />
      </div>
      <TenantTabs tenants={allTenants} currentTenantId={tenantId} maxTenants={Math.max(3, allTenants.length)} />
    </>
  );
}
