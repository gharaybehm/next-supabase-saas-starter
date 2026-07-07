/**
 * Locale-aware formatting utilities using the Intl API.
 * Numbers, percentages, and dates automatically adapt to Arabic
 * (Eastern Arabic numerals) and English.
 */

export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number, locale: string, fractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'percent',
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatTemp(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)}°`;
}

export function formatMeasurement(value: number, unit: string, locale: string, fractionDigits = 0): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value)} ${unit}`;
}

export function formatShortDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
}

export function formatWeekday(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);
}

export function formatMonthYear(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}

export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function localeToLanguageName(locale: string): string {
  const map: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
  };
  return map[locale] ?? 'English';
}
