import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createListing } from '@/app/actions/listings';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const PROPERTY_TYPES = [
  'apartment','villa','townhouse','office','retail',
  'warehouse','land','penthouse','duplex','other',
] as const;

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const t = await getTranslations('listings');

  async function handleSubmit(formData: FormData) {
    'use server';
    const result = await createListing(tenantId, formData);
    if (result.error) {
      redirect(`/${tenantId}/listings/new?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/${tenantId}/listings/${result.listingId}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${tenantId}/listings`}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('title')}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">{t('form.titleNew')}</h1>
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200/50">
        <form action={handleSubmit} className="space-y-6">
          {/* Location */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.areaLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="area" type="text" required
                placeholder={t('form.areaPlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.subCommunityLabel')}
              </label>
              <input
                name="sub_community" type="text"
                placeholder={t('form.subCommunityPlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
          </div>

          {/* Type & Status */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.typeLabel')} <span className="text-red-500">*</span>
              </label>
              <select
                name="property_type" required
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>{t(`propertyTypes.${pt}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.statusLabel')}
              </label>
              <select
                name="status"
                defaultValue="active"
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              >
                <option value="active">{t('status.active')}</option>
                <option value="pending">{t('status.pending')}</option>
              </select>
            </div>
          </div>

          {/* Price & Size */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.priceLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="price_aed" type="number" required min={1}
                placeholder={t('form.pricePlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.sizeLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="size_sqft" type="number" required min={1} step="0.01"
                placeholder={t('form.sizePlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
          </div>

          {/* Beds & Baths */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.bedsLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="bedrooms" type="number" required min={0} defaultValue={0}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.bathsLabel')} <span className="text-red-500">*</span>
              </label>
              <input
                name="bathrooms" type="number" required min={0} defaultValue={1}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
              />
            </div>
          </div>

          {/* DLD Permit */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              {t('form.dldPermitLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              name="dld_permit_no" type="text" required
              placeholder={t('form.dldPermitPlaceholder')}
              className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
            />
          </div>

          {/* Descriptions */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.descEnLabel')}
              </label>
              <textarea
                name="description_en" rows={5}
                placeholder={t('form.descEnPlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                {t('form.descArLabel')}
              </label>
              <textarea
                name="description_ar" rows={5} dir="rtl"
                placeholder={t('form.descArPlaceholder')}
                className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm resize-none font-[var(--font-noto-arabic)]"
              />
            </div>
          </div>

          {/* Virtual Tour */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              {t('form.virtualTourLabel')}
            </label>
            <input
              name="virtual_tour_url" type="url"
              placeholder={t('form.virtualTourPlaceholder')}
              className="block w-full rounded-xl border-0 py-2.5 px-3 text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-inset focus:ring-brand-600 sm:text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={`/${tenantId}/listings`}
              className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {t('form.cancel')}
            </Link>
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 transition-colors"
            >
              {t('form.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
