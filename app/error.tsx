"use client";

// App-wide fallback for everything outside the dashboard shell (workspace
// picker, login, admin) and for failures in the dashboard layout itself.
// Renders inside the root layout, so translations and fonts are available.

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errorBoundary");

  useEffect(() => {
    // The digest is the only handle on the server-side stack in production.
    console.error("[app error boundary]", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-slate-50 px-4 dark:bg-slate-900">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </span>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{t("pageTitle")}</h2>
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
            href="/tenants"
            className="flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
          >
            {t("goToTenants")}
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
