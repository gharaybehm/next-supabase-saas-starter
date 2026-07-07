import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const FIELD_CLS =
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-inset ring-ink/15 placeholder:text-muted focus:ring-2 focus:ring-terracotta outline-none transition-shadow';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLS} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${FIELD_CLS} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLS} ${className}`} {...props} />;
}

export function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={`mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>{children}</label>;
}
