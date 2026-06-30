"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Building2,
  Settings,
  MoreHorizontal,
  X,
} from "lucide-react";
import SignOutButton from "./auth/SignOutButton";
import type { TenantWithMeta } from "@/utils/supabase/tenant-types";

interface BottomNavProps {
  userRole?: "admin" | "supervisor" | "worker";
  tenantId: string;
  tenants?: TenantWithMeta[];
}

const PAGE_SLUGS = ['dashboard', 'settings'];

export default function BottomNav({ userRole, tenantId, tenants = [] }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const t = useTranslations('nav');

  function switchTenant(targetTenantId: string) {
    if (targetTenantId === tenantId) return;
    const segments = pathname.split('/').filter(Boolean);
    const lastSlug = segments[segments.length - 1] ?? 'dashboard';
    const pageSlug = PAGE_SLUGS.includes(lastSlug) ? lastSlug : 'dashboard';
    setDrawerOpen(false);
    router.push(`/${targetTenantId}/${pageSlug}`);
  }

  const primaryNav = [
    { id: "dashboard", name: t("dashboard"), href: `/${tenantId}/dashboard`, icon: LayoutDashboard },
    { id: "listings",  name: t("listings"),  href: `/${tenantId}/listings`,  icon: Building2 },
  ];

  const secondaryNav = [
    { id: "settings", name: t("settings"), href: `/${tenantId}/settings`, icon: Settings, workerHidden: true },
  ];

  const visibleSecondary = secondaryNav.filter(
    (item) => !(item.workerHidden && userRole === "worker")
  );

  return (
    <div className="relative md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        className={`absolute bottom-full start-0 end-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-xl transition-all duration-200 ease-out ${
          drawerOpen ? "opacity-100 visible translate-y-0" : "opacity-0 invisible translate-y-2"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t("more")}</span>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {visibleSecondary.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {visibleSecondary.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex flex-col items-center gap-2 rounded-xl p-3 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                        : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    <item.icon className="h-6 w-6" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          )}
          {tenants.length > 1 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mb-3">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t("tenants")}</p>
              <div className="flex flex-col gap-1">
                {tenants.map((tenant) => {
                  const isCurrent = tenant.id === tenantId;
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => switchTenant(tenant.id)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-left transition-colors ${
                        isCurrent
                          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                          : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isCurrent ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600"}`} />
                      <span className="truncate">{tenant.name}</span>
                      {isCurrent && <span className="ms-auto text-xs text-brand-500">{t("current")}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="flex h-16 items-stretch">
          {primaryNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors min-h-[44px] ${
              drawerOpen
                ? "text-brand-600 dark:text-brand-400"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <MoreHorizontal className={`h-5 w-5 ${drawerOpen ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}`} />
            <span>{t("more")}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
