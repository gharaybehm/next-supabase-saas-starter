'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { TenantWithMeta } from '@/utils/supabase/tenant-types';
import CreateTenantWizard from './CreateTenantWizard';

interface Props {
  tenants: TenantWithMeta[];
  currentTenantId: string;
  maxTenants?: number;
}

const SLOT_STYLES = [
  {
    active:   'bg-brand-600 border-brand-600 text-white shadow-brand-200',
    inactive: 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100',
    empty:    'border-brand-200 text-brand-300 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50',
  },
  {
    active:   'bg-emerald-600 border-emerald-600 text-white shadow-emerald-200',
    inactive: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    empty:    'border-emerald-200 text-emerald-300 hover:border-emerald-400 hover:text-emerald-500 hover:bg-emerald-50',
  },
  {
    active:   'bg-amber-500 border-amber-500 text-white shadow-amber-200',
    inactive: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    empty:    'border-amber-200 text-amber-300 hover:border-amber-400 hover:text-amber-500 hover:bg-amber-50',
  },
];

const PAGE_SLUGS = ['dashboard', 'settings'];

export default function TenantTabs({ tenants, currentTenantId, maxTenants = 3 }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [wizardOpen, setWizardOpen] = useState(false);

  const segments = pathname.split('/').filter(Boolean);
  const lastSlug = segments[segments.length - 1] ?? 'dashboard';
  const pageSlug = PAGE_SLUGS.includes(lastSlug) ? lastSlug : 'dashboard';

  function switchTenant(tenantId: string) {
    if (tenantId === currentTenantId) return;
    router.push(`/${tenantId}/${pageSlug}`);
  }

  const visibleTenants = tenants.slice(0, maxTenants);

  return (
    <>
      {/* Right-edge folder tabs — desktop only */}
      <div
        className="hidden md:flex fixed right-0 z-50 flex-col gap-2"
        style={{ top: '40%', transform: 'translateY(-50%)' }}
      >
        {Array.from({ length: maxTenants }, (_, i) => {
          const tenant = visibleTenants[i];
          const styles = SLOT_STYLES[i % SLOT_STYLES.length];

          if (tenant) {
            const isActive = tenant.id === currentTenantId;
            const label = tenant.name.length > 10 ? tenant.name.slice(0, 10) : tenant.name;
            return (
              <button
                key={tenant.id}
                onClick={() => switchTenant(tenant.id)}
                title={tenant.name}
                className={`
                  flex items-center justify-center w-11
                  border border-r-0 shadow-sm transition-all duration-200
                  ${isActive
                    ? `${styles.active} shadow-md translate-x-0`
                    : `${styles.inactive} translate-x-1 hover:translate-x-0 hover:shadow-md`
                  }
                `}
                style={{ height: '96px', borderRadius: '10px 0 0 10px' }}
              >
                <span
                  className="text-[11px] font-semibold tracking-wide select-none"
                  style={{ writingMode: 'vertical-rl', overflow: 'hidden', maxHeight: '80px' }}
                >
                  {label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={`empty-${i}`}
              onClick={() => setWizardOpen(true)}
              title="Create new workspace"
              className={`
                flex items-center justify-center w-11
                border border-r-0 border-dashed
                bg-white dark:bg-slate-900
                transition-all duration-200
                translate-x-1 hover:translate-x-0 hover:shadow-md
                ${styles.empty}
              `}
              style={{ height: '56px', borderRadius: '10px 0 0 10px' }}
            >
              <Plus className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <CreateTenantWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  );
}
