import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export default function AdminSectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8 dark:bg-slate-900 dark:ring-slate-700">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Icon className="h-5 w-5 text-brand-600" />
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {children}
    </section>
  );
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-brand-50 text-brand-700",
  trialing: "bg-blue-50 text-blue-700",
  past_due: "bg-red-50 text-red-700",
  unpaid: "bg-red-50 text-red-700",
};

export function SubscriptionStatusBadge({ status }: { status: string | null }) {
  const cls = (status && STATUS_STYLES[status]) || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${cls}`}>
      {status ? status.replace(/_/g, " ") : "No plan"}
    </span>
  );
}

export function AdminTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{children}</tbody>
      </table>
    </div>
  );
}
