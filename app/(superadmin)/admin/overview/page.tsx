import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { getTenantOverview } from "@/app/(superadmin)/admin/actions";
import AdminSectionCard, { AdminTable, SubscriptionStatusBadge } from "@/app/components/admin/AdminSectionCard";

export default async function AdminOverviewPage() {
  const { tenants, error } = await getTenantOverview();
  const rows = tenants ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Workspaces</h1>
        <p className="mt-1 text-sm text-slate-500">Every workspace on the platform, who owns it, and its organization&apos;s plan.</p>
      </div>

      <AdminSectionCard title="All workspaces" icon={LayoutGrid} description={`${rows.length} workspace${rows.length === 1 ? "" : "s"}`}>
        {error ? (
          <div className="py-6 text-center text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No workspaces yet.</div>
        ) : (
          <AdminTable headers={["Workspace", "Members", "Owner", "Plan", "Created"]}>
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                  <Link href={`/admin/overview/${t.id}`} className="text-brand-700 underline-offset-2 hover:underline">{t.name}</Link>
                  <p className="text-xs font-normal text-slate-400">{t.organizationName || "No organization"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{t.memberCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{t.ownerName || t.ownerEmail || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3"><SubscriptionStatusBadge status={t.subscriptionStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSectionCard>
    </div>
  );
}
