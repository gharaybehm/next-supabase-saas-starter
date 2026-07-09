import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/utils/supabase/server';
import { createListing } from '@/app/actions/listings';
import { getTenantMembers } from '@/app/actions/deals';
import Card from '@/app/components/ui/Card';
import { Input, Select, Label } from '@/app/components/ui/fields';
import StatusBadge from '@/app/components/ui/StatusBadge';
import DescriptionField from './components/DescriptionField';
import TransactionTypeField from './components/TransactionTypeField';
import LocationFields from './components/LocationFields';
import PhotoUploadField from './components/PhotoUploadField';
import { CheckCircle2 } from 'lucide-react';

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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const members = await getTenantMembers(tenantId);
  const otherMembers = members.filter((m) => m.user_id !== user?.id);

  async function handleSubmit(formData: FormData) {
    'use server';
    const result = await createListing(tenantId, formData);
    if (result.error) {
      redirect(`/${tenantId}/listings/new?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/${tenantId}/listings/${result.listingId}`);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-ink">{t('form.titleNew')}</h1>

      <form id="new-listing-form" action={handleSubmit} encType="multipart/form-data" className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">Location &amp; type</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <LocationFields
                areaLabel={t('form.areaLabel')}
                areaPlaceholder={t('form.areaPlaceholder')}
                subCommunityLabel={t('form.subCommunityLabel')}
                subCommunityPlaceholder={t('form.subCommunityPlaceholder')}
              />
              <div>
                <Label>{t('form.typeLabel')}</Label>
                <Select name="property_type" required>
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>{t(`propertyTypes.${pt}`)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('form.bedsLabel')}</Label>
                <Input name="bedrooms" type="number" required min={0} defaultValue={0} />
              </div>
              <div>
                <Label>{t('form.bathsLabel')}</Label>
                <Input name="bathrooms" type="number" required min={0} defaultValue={1} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">Price &amp; size</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <TransactionTypeField
                transactionTypeLabel={t('form.transactionTypeLabel')}
                saleLabel={t('transactionTypes.sale')}
                rentLabel={t('transactionTypes.rent')}
                priceLabelSale={t('form.priceLabel')}
                priceLabelRent={t('form.rentLabel')}
                pricePlaceholder={t('form.pricePlaceholder')}
              />
              <div>
                <Label>{t('form.sizeLabel')}</Label>
                <Input name="size_sqft" type="number" required min={1} step="0.01" placeholder={t('form.sizePlaceholder')} />
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">Description</h2>
            <DescriptionField
              enPlaceholder={t('form.descEnPlaceholder')}
              arPlaceholder={t('form.descArPlaceholder')}
            />
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-ink">
              {t('form.photosLabel')}
            </h2>
            <p className="mb-3 text-xs text-muted">Photos are automatically watermarked with your broker details. You can also add more later from the listing page.</p>
            <PhotoUploadField />

            <div className="mt-4">
              <Label>{t('form.virtualTourLabel')}</Label>
              <Input name="virtual_tour_url" type="url" placeholder={t('form.virtualTourPlaceholder')} />
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-ink">DLD permit</h2>
            <Label>{t('form.dldPermitLabel')}</Label>
            <Input name="dld_permit_no" type="text" required placeholder={t('form.dldPermitPlaceholder')} />
            <div className="mt-3 flex items-center gap-2 text-xs text-[color:var(--color-status-active)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Permit format looks valid — pending real DLD verification
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-ink">Co-authorize brokers</h2>
            <p className="mb-3 text-xs text-muted">Choose up to 2 co-brokers (3 total, per DLD rule).</p>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {otherMembers.length === 0 && <p className="text-xs text-muted">No other members yet.</p>}
              {otherMembers.map((m) => (
                <label key={m.user_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-ink/5">
                  <input type="checkbox" name="co_broker_ids" value={m.user_id} className="accent-terracotta" />
                  <span className="text-ink">{m.full_name}</span>
                  <span className="text-xs text-muted">RERA {m.rera_card_no}</span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">{t('form.statusLabel')}</h2>
            <StatusBadge status="active" label={t('status.active')} />
            <input type="hidden" name="status" value="active" />
          </Card>
        </div>
      </form>
    </div>
  );
}
