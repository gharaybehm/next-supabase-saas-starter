'use client'

import { LogOut } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import { useTranslations } from 'next-intl'

// Must match PAGE_CACHE's prefix in public/sw.js.
const PAGE_CACHE_PREFIX = 'app-pages'

/**
 * The service worker keeps the last-loaded tenant pages so they open with no
 * signal. They hold the signed-in person's tenant data, so they are removed on
 * sign-out: the next person on a shared device must not be shown them.
 */
async function signOutAndForget() {
  try {
    const names = await caches.keys()
    await Promise.all(names.filter((n) => n.startsWith(PAGE_CACHE_PREFIX)).map((n) => caches.delete(n)))
  } catch {
    // No Cache Storage (older browser, private window): nothing was kept.
  }
  await signOut()
}

export default function SignOutButton({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('auth')

  if (compact) {
    return (
      <button
        onClick={() => void signOutAndForget()}
        aria-label={t('signOut')}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      onClick={() => void signOutAndForget()}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      <LogOut className="h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300" aria-hidden="true" />
      {t('signOut')}
    </button>
  )
}
