import Link from "next/link";
import { Building2 } from "lucide-react";
import { getSubscribers } from "@/app/(superadmin)/admin/actions";
import AdminSectionCard, { AdminTable, SubscriptionStatusBadge } from "@/app/components/admin/AdminSectionCard";

export default async function AdminSubscribersPage() {
  const { subscribers, error } = await getSubscribers();
  const rows = subscribers ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Subscribers</h1>
        <p className="mt-1 text-sm text-slate-500">Every organization on the platform and its billing status.</p>
      </div>

      <AdminSectionCard title="Organizations" icon={Building2} description={`${rows.length} subscriber${rows.length === 1 ? "" : "s"}`}>
        {error ? (
          <div className="py-6 text-center text-sm text-red-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No organizations yet.</div>
        ) : (
          <AdminTable headers={["Organization", "Billing email", "Plan", "Seats used", "Members", "Created", ""]}>
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{s.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{s.billingEmail}</td>
                <td className="whitespace-nowrap px-4 py-3"><SubscriptionStatusBadge status={s.subscriptionStatus} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{s.tenantCount} / {s.tenantSeats}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{s.memberCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-end text-sm">
                  <Link href={`/admin/subscribers/${s.id}`} className="font-medium text-brand-700 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSectionCard>
    </div>
  );
}
