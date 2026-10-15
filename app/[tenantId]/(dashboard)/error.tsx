"use client";

// Contains a render or server-action failure to the dashboard's main content
// area: the sidebar and navs stay mounted and usable, so one broken page does
// not take the whole app down. Errors in the dashboard layout itself fall
// through to app/error.tsx, and a root-layout failure to app/global-error.tsx.

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary");
  const params = useParams<{ tenantId: string }>();
  const tenantId = typeof params?.tenantId === "string" ? params.tenantId : null;

  useEffect(() => {
    // The digest is the only handle on the server-side stack in production.
    console.error("[dashboard error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{t("title")}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("description")}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            <RotateCw className="h-4 w-4" />
            {t("retry")}
          </button>
          <Link
            href={tenantId ? `/${tenantId}/dashboard` : "/tenants"}
            className="flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            {tenantId ? t("goToDashboard") : t("goToTenants")}
          </Link>
        </div>

        {error.digest && (
          <p className="mt-4 font-mono text-[11px] text-slate-400">
            {t("referenceLabel")}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
