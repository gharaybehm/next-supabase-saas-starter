'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Logo from './ui/Logo';

interface AdminTopNavProps {
  tenantId: string;
}

export default function AdminTopNav({ tenantId }: AdminTopNavProps) {
  const pathname = usePathname();
  const t = useTranslations('admin.nav');
  const tNav = useTranslations('nav');

  const tabs = [
    { id: 'management', name: t('management'), href: `/${tenantId}/admin/management` },
    { id: 'billing', name: t('billing'), href: `/${tenantId}/admin/billing` },
  ];

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-ink/10 bg-paper px-4 md:px-6">
      <Link href={`/${tenantId}/dashboard`} className="flex shrink-0 items-center gap-2">
        <Logo size={22} />
        <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-paper">
          {tNav('admin')}
        </span>
      </Link>

      <nav className="flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                active ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
              }`}
            >
              {tab.name}
            </Link>
          );
        })}
      </nav>

      <Link href={`/${tenantId}/dashboard`} className="ms-auto text-sm font-medium text-muted hover:text-ink">
        {tNav('dashboard')}
      </Link>
    </header>
  );
}
