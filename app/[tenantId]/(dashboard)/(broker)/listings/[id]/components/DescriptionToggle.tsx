'use client';

import { useState } from 'react';
import SegmentedControl from '@/app/components/ui/SegmentedControl';

interface DescriptionToggleProps {
  descriptionEn?: string;
  descriptionAr?: string;
}

export default function DescriptionToggle({ descriptionEn, descriptionAr }: DescriptionToggleProps) {
  const [locale, setLocale] = useState<'en' | 'ar'>('en');

  if (!descriptionEn && !descriptionAr) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">Description</h3>
        {descriptionEn && descriptionAr && (
          <SegmentedControl
            options={[{ value: 'en', label: 'EN' }, { value: 'ar', label: 'AR' }]}
            value={locale}
            onChange={(v) => setLocale(v as 'en' | 'ar')}
          />
        )}
      </div>
      {locale === 'en' && descriptionEn && (
        <p className="text-sm leading-relaxed text-muted">{descriptionEn}</p>
      )}
      {locale === 'ar' && descriptionAr && (
        <p dir="rtl" className="font-arabic text-sm leading-relaxed text-muted">{descriptionAr}</p>
      )}
    </div>
  );
}
