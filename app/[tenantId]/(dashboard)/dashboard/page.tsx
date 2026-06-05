import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard.page');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('title')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subtitle')}</p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
          {t('welcomeTitle')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('welcomeSubtitle')}
        </p>
      </div>
    </div>
  );
}
