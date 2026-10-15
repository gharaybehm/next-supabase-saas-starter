"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, ShieldAlert } from "lucide-react";
import SignOutButton from "@/app/components/auth/SignOutButton";

const navItems = [
  { id: "overview", name: "Workspaces", href: "/admin/overview", icon: LayoutGrid },
  { id: "subscribers", name: "Subscribers", href: "/admin/subscribers", icon: Building2 },
];

export default function AdminNav({ userEmail, userName }: { userEmail?: string; userName?: string }) {
  const pathname = usePathname();

  const initials = (() => {
    if (userName) {
      const parts = userName.split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return userName.substring(0, 2).toUpperCase();
    }
    return userEmail ? userEmail.substring(0, 2).toUpperCase() : "SA";
  })();

  return (
    // Logo and user row are pinned; the links scroll between them, so a short
    // window never pushes the page taller than the screen.
    <aside className="flex h-full w-64 shrink-0 flex-col bg-slate-900 text-slate-300">
      <div className="flex shrink-0 items-center gap-2 px-5 py-6">
        <ShieldAlert className="h-6 w-6 text-brand-400" strokeWidth={2.25} />
        <div>
          <p className="text-sm font-semibold tracking-wide text-white">Super Admin</p>
          <p className="text-[11px] text-slate-400">Platform oversight</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:bg-white/5"
              }`}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${isActive ? "text-brand-400" : "text-slate-500"}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-3 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-xs font-semibold text-brand-300">
          {initials}
        </div>
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{userName || userEmail}</p>
        <SignOutButton compact />
      </div>
    </aside>
  );
}
