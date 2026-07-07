'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input, Select } from '@/app/components/ui/fields';
import { Chip } from '@/app/components/ui/Chip';

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

interface ListingsFilterBarProps {
  resultCount: number;
  totalCount: number;
}

export default function ListingsFilterBar({ resultCount, totalCount }: ListingsFilterBarProps) {
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

  function applyWith(overrides: Record<string, string>) {
    const values = {
      area, property_type: propertyType, bedrooms_min: bedroomsMin,
      price_min: priceMin, price_max: priceMax, size_min: sizeMin,
      status, sort, ...overrides,
    };
    const params = new URLSearchParams();
    if (values.area) params.set('area', values.area);
    if (values.property_type) params.set('property_type', values.property_type);
    if (values.bedrooms_min) params.set('bedrooms_min', values.bedrooms_min);
    if (values.price_min) params.set('price_min', values.price_min);
    if (values.price_max) params.set('price_max', values.price_max);
    if (values.size_min) params.set('size_min', values.size_min);
    if (values.status) params.set('status', values.status);
    if (values.sort && values.sort !== 'newest') params.set('sort', values.sort);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleStatusClick(value: string) {
    setStatus(value);
    applyWith({ status: value });
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
    <div className="space-y-3">
      {/* Row 1: selects */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        <Input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyWith({})}
          placeholder={tf('areaPlaceholder')}
        />
        <Select value={propertyType} onChange={(e) => { setPropertyType(e.target.value); applyWith({ property_type: e.target.value }); }}>
          <option value="">{tf('typePlaceholder')}</option>
          {PROPERTY_TYPES.map((pt) => (
            <option key={pt} value={pt}>{t(`propertyTypes.${pt}`)}</option>
          ))}
        </Select>
        <Select value={bedroomsMin} onChange={(e) => { setBedroomsMin(e.target.value); applyWith({ bedrooms_min: e.target.value }); }}>
          {BEDROOM_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {'labelKey' in opt ? tf(opt.labelKey) : opt.label}
            </option>
          ))}
        </Select>
        <Input type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} onBlur={() => applyWith({})} placeholder={tf('priceMin')} min={0} />
        <Input type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} onBlur={() => applyWith({})} placeholder={tf('priceMax')} min={0} />
        <Input type="number" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} onBlur={() => applyWith({})} placeholder={tf('sizeMin')} min={0} />
        <Select value={sort} onChange={(e) => { setSort(e.target.value); applyWith({ sort: e.target.value }); }}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{tf(opt.labelKey)}</option>
          ))}
        </Select>
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-muted hover:text-ink transition-colors"
        >
          {tf('reset')}
        </button>
      </div>

      {/* Row 2: status chips + count */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex gap-2">
          <Chip label={tf('statusPlaceholder')} active={status === ''} onClick={() => handleStatusClick('')} />
          {STATUSES.map((s) => (
            <Chip key={s} label={t(`status.${s}`)} active={status === s} onClick={() => handleStatusClick(s)} />
          ))}
        </div>
        <span className="shrink-0 text-xs text-muted">{resultCount} of {totalCount} listings</span>
      </div>
    </div>
  );
}
