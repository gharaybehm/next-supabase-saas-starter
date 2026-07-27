'use client';

import { useState } from 'react';
import SegmentedControl from '@/app/components/ui/SegmentedControl';
import { Textarea } from '@/app/components/ui/fields';

interface DescriptionFieldProps {
  enPlaceholder: string;
  arPlaceholder: string;
  initialEn?: string;
  initialAr?: string;
}

export default function DescriptionField({ enPlaceholder, arPlaceholder, initialEn, initialAr }: DescriptionFieldProps) {
  const [locale, setLocale] = useState<'en' | 'ar'>('en');
  const [en, setEn] = useState(initialEn ?? '');
  const [ar, setAr] = useState(initialAr ?? '');

  return (
    <div>
      <SegmentedControl
        options={[{ value: 'en', label: 'EN' }, { value: 'ar', label: 'AR' }]}
        value={locale}
        onChange={(v) => setLocale(v as 'en' | 'ar')}
        className="mb-3"
      />
      {locale === 'en' ? (
        <Textarea
          name="description_en"
          rows={6}
          value={en}
          onChange={(e) => setEn(e.target.value)}
          placeholder={enPlaceholder}
        />
      ) : (
        <Textarea
          name="description_ar"
          rows={6}
          dir="rtl"
          className="font-arabic"
          value={ar}
          onChange={(e) => setAr(e.target.value)}
          placeholder={arPlaceholder}
        />
      )}
      {/* Keep both values submitted regardless of which is currently shown */}
      <input type="hidden" name={locale === 'en' ? 'description_ar' : 'description_en'} value={locale === 'en' ? ar : en} />
    </div>
  );
}
