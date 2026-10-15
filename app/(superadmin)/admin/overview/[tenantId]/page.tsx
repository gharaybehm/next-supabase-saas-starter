import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { getTenantDetail } from "@/app/(superadmin)/admin/actions";
import AdminSectionCard, { AdminTable, SubscriptionStatusBadge } from "@/app/components/admin/AdminSectionCard";

// What the operator may see of one workspace: its members, their roles and
// when they last signed in. Nothing the workspace's users wrote.
export default async function AdminTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { detail, error } = await getTenantDetail(tenantId);
  if (error || !detail) notFound();

  const { tenant, members } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/overview" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to workspaces
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{tenant.name}</h1>
          <SubscriptionStatusBadge status={tenant.subscriptionStatus} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {tenant.organizationName || "No organization"} · created {new Date(tenant.createdAt).toLocaleDateString()}
        </p>
      </div>

      <AdminSectionCard title="Members" icon={Users} description={`${members.length} member${members.length === 1 ? "" : "s"}`}>
        {members.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No members.</div>
        ) : (
          <AdminTable headers={["Name", "Email", "Role", "Last sign-in"]}>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{m.name || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{m.email || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{m.role}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                  {m.lastSignInAt ? new Date(m.lastSignInAt).toLocaleString() : "Never"}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSectionCard>
    </div>
  );
}
