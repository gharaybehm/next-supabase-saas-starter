'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2 } from 'lucide-react';
import { createTenant } from '@/app/actions/tenants';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateTenantWizard({ open, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [serverError, setServerError] = useState('');

  if (!open) return null;

  function handleClose() {
    if (isPending) return;
    setName('');
    setDescription('');
    setServerError('');
    onClose();
  }

  function handleCreate() {
    setServerError('');
    startTransition(async () => {
      const result = await createTenant({ name, description: description || undefined });
      if (result.error) {
        setServerError(result.error);
        return;
      }
      router.push(`/${result.tenantId}/dashboard`);
      router.refresh();
      handleClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Create a new workspace
          </h2>
          <button
            onClick={handleClose}
            disabled={isPending}
            className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta"
            />
          </div>

          {serverError && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {serverError}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={handleCreate}
              disabled={isPending || !name.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2 text-sm font-medium text-white hover:bg-terracotta/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
