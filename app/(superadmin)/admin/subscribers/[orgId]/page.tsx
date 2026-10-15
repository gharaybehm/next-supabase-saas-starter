import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LayoutGrid, Receipt, Users } from "lucide-react";
import { getSubscriberDetail } from "@/app/(superadmin)/admin/actions";
import AdminSectionCard, { AdminTable, SubscriptionStatusBadge } from "@/app/components/admin/AdminSectionCard";

function formatCurrency(amountInSmallestUnit: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amountInSmallestUnit / 100);
}

export default async function SubscriberDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { subscriber, error } = await getSubscriberDetail(orgId);
  if (error || !subscriber) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/subscribers" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to subscribers
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">{subscriber.name}</h1>
          <SubscriptionStatusBadge status={subscriber.subscriptionStatus} />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {subscriber.billingEmail} · {subscriber.tenants.length} / {subscriber.tenantSeats} seats used
        </p>
        {subscriber.stripeCustomerId && (
          <p className="mt-1 font-mono text-xs text-slate-400">
            Stripe customer: {subscriber.stripeCustomerId}
            {subscriber.stripeSubscriptionId ? ` · Subscription: ${subscriber.stripeSubscriptionId}` : ""}
          </p>
        )}
      </div>

      <AdminSectionCard title="Members" icon={Users} description={`${subscriber.members.length} member${subscriber.members.length === 1 ? "" : "s"}`}>
        {subscriber.members.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No members.</div>
        ) : (
          <AdminTable headers={["Name", "Email", "Role"]}>
            {subscriber.members.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{m.name || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{m.email || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">{m.role}</td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSectionCard>

      <AdminSectionCard title="Workspaces" icon={LayoutGrid} description={`${subscriber.tenants.length} workspace${subscriber.tenants.length === 1 ? "" : "s"}`}>
        {subscriber.tenants.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No workspaces yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {subscriber.tenants.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3">
                <Link href={`/admin/overview/${t.id}`} className="text-sm font-medium text-brand-700 hover:underline">{t.name}</Link>
                <span className="text-xs text-slate-400">Created {new Date(t.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminSectionCard>

      <AdminSectionCard title="Payment history" icon={Receipt} description={`${subscriber.invoices.length} invoice${subscriber.invoices.length === 1 ? "" : "s"} synced from Stripe`}>
        {subscriber.invoices.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No invoices yet.</div>
        ) : (
          <AdminTable headers={["Date", "Amount", "Status", ""]}>
            {subscriber.invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{formatCurrency(inv.amountPaid, inv.currency)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">{inv.status}</td>
                <td className="whitespace-nowrap px-4 py-3 text-end text-sm">
                  {inv.hostedInvoiceUrl && (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 hover:underline">
                      View invoice
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminSectionCard>
    </div>
  );
}
