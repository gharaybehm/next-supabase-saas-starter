import Sidebar from "@/app/components/Sidebar";
import TopNav from "@/app/components/TopNav";
import BottomNav from "@/app/components/BottomNav";
import TenantTabs from "@/app/components/tenants/TenantTabs";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getTenants } from "@/app/actions/tenants";

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

  // Verify the user is a member of this tenant
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

  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: profile } = await (supabase as any)
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    const defaultProfile = {
      id: user.id,
      full_name: fullName || "User",
      phone: user.user_metadata?.phone || null,
      role: "worker" as const,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newProfile, error: insertError } = await (supabase as any)
      .from("user_profiles")
      .insert(defaultProfile)
      .select()
      .single();

    if (!insertError && newProfile) {
      profile = newProfile;
    } else {
      profile = {
        id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        full_name: defaultProfile.full_name,
        phone: defaultProfile.phone,
        role: "worker",
      };
    }
  }

  // Per-tenant role takes precedence for UI gating
  const effectiveRole = (membership.role as "admin" | "supervisor" | "worker") ?? profile.role;

  const allTenants = await getTenants();

  return (
    <>
      <Sidebar
        userEmail={user.email}
        userName={profile.full_name ?? fullName}
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
      <TenantTabs tenants={allTenants} currentTenantId={tenantId} maxTenants={3} />
    </>
  );
}
