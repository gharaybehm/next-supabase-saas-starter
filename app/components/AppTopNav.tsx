'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useState, useRef, useEffect, useTransition } from 'react';
import { Search, Globe, Plus, CheckCircle2, LogOut } from 'lucide-react';
import Logo from './ui/Logo';
import { setLocale } from '@/app/actions/settings';
import { signOut } from '@/app/actions/auth';
import type { TenantWithMeta } from '@/utils/supabase/tenant-types';

interface AppTopNavProps {
  tenantId: string;
  agreementSigned?: boolean;
  userInitials: string;
  tenants?: TenantWithMeta[];
  isAdmin?: boolean;
}

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'العربية' },
];

export default function AppTopNav({ tenantId, agreementSigned, userInitials, tenants = [], isAdmin }: AppTopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('nav');
  const tTop = useTranslations('topNav');
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLocaleSelect(newLocale: string) {
    if (newLocale === locale) return;
    startTransition(async () => {
      await setLocale(newLocale);
      window.location.reload();
    });
  }

  const isListings = pathname.includes('/listings') && !pathname.includes('/listings/new');
  const isNewListing = pathname.endsWith('/listings/new');

  const navLinks = [
    { id: 'listings', name: t('listings'), href: `/${tenantId}/listings` },
    { id: 'dashboard', name: t('dashboard'), href: `/${tenantId}/dashboard` },
    { id: 'team', name: t('team'), href: `/${tenantId}/team` },
    { id: 'profile', name: t('profile'), href: `/${tenantId}/profile` },
    ...(isAdmin ? [{ id: 'admin', name: t('admin'), href: `/${tenantId}/admin` }] : []),
  ];

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-ink/10 bg-paper px-4 md:px-6">
      <Link href={`/${tenantId}/listings`} className="shrink-0">
        <Logo size={24} />
      </Link>

      <nav className="hidden md:flex items-center gap-6">
        {navLinks.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.id}
              href={link.href}
              className={`border-b-2 pb-1 text-sm font-medium transition-colors ${
                active ? 'border-terracotta font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {link.name}
            </Link>
          );
        })}
      </nav>

      {isListings && (
        <div className="hidden md:block w-full max-w-xs relative ms-4">
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted" />
          <input
            type="search"
            className="block w-full rounded-lg border-0 bg-white py-1.5 ps-9 pe-3 text-sm text-ink ring-1 ring-inset ring-ink/15 placeholder:text-muted focus:ring-2 focus:ring-terracotta outline-none"
            placeholder={tTop('searchPlaceholder')}
          />
        </div>
      )}

      <div className="ms-auto flex items-center gap-2">
        {isNewListing ? (
          <div className="flex items-center gap-2">
            <Link href={`/${tenantId}/listings`} className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
              {tTop('cancel')}
            </Link>
            <button
              type="submit"
              form="new-listing-form"
              className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              {tTop('publish')}
            </button>
          </div>
        ) : (
          <Link
            href={`/${tenantId}/listings/new`}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            {t('newListing')}
          </Link>
        )}

        {agreementSigned && (
          <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-[color:var(--color-status-active-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-status-active)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {tTop('agreementSigned')}
          </span>
        )}

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper"
          >
            {userInitials}
          </button>

          {menuOpen && (
            <div className="absolute end-0 top-full mt-2 w-56 rounded-xl border border-ink/10 bg-white shadow-lg overflow-hidden z-50">
              <div className="border-b border-ink/10 p-2">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{tTop('language')}</p>
                {LOCALE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleLocaleSelect(opt.value)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-start ${
                      locale === opt.value ? 'bg-terracotta/10 font-semibold text-terracotta' : 'text-ink hover:bg-ink/5'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>

              {tenants.length > 1 && (
                <div className="border-b border-ink/10 p-2">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{t('tenants')}</p>
                  {tenants.map((tenant) => (
                    <button
                      key={tenant.id}
                      onClick={() => {
                        setMenuOpen(false);
                        router.push(`/${tenant.id}/listings`);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-start truncate ${
                        tenant.id === tenantId ? 'font-semibold text-terracotta' : 'text-ink hover:bg-ink/5'
                      }`}
                    >
                      {tenant.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="p-2">
                <button
                  onClick={() => signOut()}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-ink/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {tTop('signOut')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
