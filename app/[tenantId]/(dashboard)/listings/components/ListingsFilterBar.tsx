'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

const PROPERTY_TYPES = [
  'apartment','villa','townhouse','office','retail',
  'warehouse','land','penthouse','duplex','other',
] as const;

const STATUSES = ['active','pending','sold','expired'] as const;

const BEDROOM_OPTIONS = [
  { value: '', labelKey: 'bedroomsAny' },
  { value: '0', labelKey: 'bedroomsStudio' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5+' },
] as const;

const SORT_OPTIONS = [
  { value: 'newest',     labelKey: 'sortNewest' },
  { value: 'oldest',     labelKey: 'sortOldest' },
  { value: 'price_asc',  labelKey: 'sortPriceAsc' },
  { value: 'price_desc', labelKey: 'sortPriceDesc' },
  { value: 'size_asc',   labelKey: 'sortSizeAsc' },
  { value: 'size_desc',  labelKey: 'sortSizeDesc' },
] as const;

const INPUT_CLS = 'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white';

export default function ListingsFilterBar() {
  const t = useTranslations('listings');
  const tf = useTranslations('listings.filters');
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [area, setArea] = useState(sp.get('area') ?? '');
  const [propertyType, setPropertyType] = useState(sp.get('property_type') ?? '');
  const [bedroomsMin, setBedroomsMin] = useState(sp.get('bedrooms_min') ?? '');
  const [priceMin, setPriceMin] = useState(sp.get('price_min') ?? '');
  const [priceMax, setPriceMax] = useState(sp.get('price_max') ?? '');
  const [sizeMin, setSizeMin] = useState(sp.get('size_min') ?? '');
  const [status, setStatus] = useState(sp.get('status') ?? 'active');
  const [sort, setSort] = useState(sp.get('sort') ?? 'newest');

  function handleApply() {
    const params = new URLSearchParams();
    if (area)          params.set('area', area);
    if (propertyType)  params.set('property_type', propertyType);
    if (bedroomsMin)   params.set('bedrooms_min', bedroomsMin);
    if (priceMin)      params.set('price_min', priceMin);
    if (priceMax)      params.set('price_max', priceMax);
    if (sizeMin)       params.set('size_min', sizeMin);
    if (status)        params.set('status', status);
    if (sort && sort !== 'newest') params.set('sort', sort);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleReset() {
    setArea('');
    setPropertyType('');
    setBedroomsMin('');
    setPriceMin('');
    setPriceMax('');
    setSizeMin('');
    setStatus('active');
    setSort('newest');
    router.replace(pathname);
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
      <p className="mb-4 text-sm font-semibold text-zinc-700">{tf('title')}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {/* Area */}
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          placeholder={tf('areaPlaceholder')}
          className={INPUT_CLS}
        />

        {/* Property type */}
        <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={INPUT_CLS}>
          <option value="">{tf('typePlaceholder')}</option>
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt} value={pt}>{t(`propertyTypes.${pt}`)}</option>
          ))}
        </select>

        {/* Bedrooms */}
        <select value={bedroomsMin} onChange={(e) => setBedroomsMin(e.target.value)} className={INPUT_CLS}>
          {BEDROOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {'labelKey' in opt ? tf(opt.labelKey) : opt.label}
            </option>
          ))}
        </select>

        {/* Price min */}
        <input
          type="number"
          value={priceMin}
          onChange={(e) => setPriceMin(e.target.value)}
          placeholder={tf('priceMin')}
          className={INPUT_CLS}
          min={0}
        />

        {/* Price max */}
        <input
          type="number"
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder={tf('priceMax')}
          className={INPUT_CLS}
          min={0}
        />

        {/* Size min */}
        <input
          type="number"
          value={sizeMin}
          onChange={(e) => setSizeMin(e.target.value)}
          placeholder={tf('sizeMin')}
          className={INPUT_CLS}
          min={0}
        />

        {/* Status */}
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={INPUT_CLS}>
          <option value="">{tf('statusPlaceholder')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{t(`status.${s}`)}</option>
          ))}
        </select>

        {/* Sort */}
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={INPUT_CLS}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{tf(opt.labelKey)}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-2 justify-end">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          {tf('reset')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition-colors"
        >
          {tf('apply')}
        </button>
      </div>
    </div>
  );
}
