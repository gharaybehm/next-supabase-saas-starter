import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminNav from "@/app/components/admin/AdminNav";

export const dynamic = "force-dynamic";

// The platform operator's area. Only user_profiles.role = 'super_admin' gets
// in; that role is set by hand (see 20261015000100_super_admin_and_billing.sql)
// and is never client-writable. Each action re-checks it.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("user_profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") redirect("/tenants");

  return (
    <>
      <AdminNav userEmail={user.email} userName={profile.full_name ?? undefined} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 dark:bg-slate-950">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </>
  );
}
