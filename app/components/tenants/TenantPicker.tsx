'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Plus, SquareStack } from 'lucide-react';
import type { TenantWithMeta } from '@/utils/supabase/tenant-types';
import CreateTenantWizard from './CreateTenantWizard';

interface Props {
  tenants: TenantWithMeta[];
}

const roleStyles: Record<string, string> = {
  admin:      'bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400',
  supervisor: 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400',
  worker:     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400',
};

export default function TenantPicker({ tenants }: Props) {
  const router = useRouter();
  const [wizardOpen, setWizardOpen] = useState(tenants.length === 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3">
        <Image src="/icon.png" alt="App" width={44} height={44} className="object-contain" />
        <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">My App</span>
      </div>

      <div className="w-full max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Workspaces</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Select a workspace to continue, or create a new one.
          </p>
        </div>

        {tenants.length === 0 && !wizardOpen && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
            <SquareStack className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No workspaces yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-4">
              Create your first workspace to get started.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Workspace
            </button>
          </div>
        )}

        {tenants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => router.push(`/${tenant.id}/dashboard`)}
                className="text-left rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-200 dark:ring-slate-800 p-6 hover:shadow-lg hover:ring-brand-300 dark:hover:ring-brand-700 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors leading-tight">
                    {tenant.name}
                  </h2>
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md shrink-0 ${roleStyles[tenant.userRole] ?? roleStyles.worker}`}>
                    {tenant.userRole}
                  </span>
                </div>
                {tenant.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">
                    {tenant.description}
                  </p>
                )}
              </button>
            ))}

            {/* New workspace card */}
            <button
              onClick={() => setWizardOpen(true)}
              className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 group min-h-[140px]"
            >
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/30 flex items-center justify-center transition-colors">
                <Plus className="h-5 w-5 group-hover:text-brand-600 transition-colors" />
              </div>
              <span className="text-sm font-medium group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                New Workspace
              </span>
            </button>
          </div>
        )}
      </div>

      <CreateTenantWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
