'use client';

import { useState, useTransition } from 'react';
import { Pencil } from 'lucide-react';
import { Input, Label } from '@/app/components/ui/fields';
import { updateProfileDetails, type ProfileDetails } from '@/app/actions/profile';

interface EditProfileFormProps {
  tenantId: string;
  initialValues: ProfileDetails;
}

const ROWS: { key: keyof ProfileDetails; label: string }[] = [
  { key: 'full_name', label: 'Full name' },
  { key: 'phone', label: 'Phone' },
  { key: 'rera_card_no', label: 'DLD license' },
];

export default function EditProfileForm({ tenantId, initialValues }: EditProfileFormProps) {
  const [saved, setSaved] = useState(initialValues);
  const [values, setValues] = useState(initialValues);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isPending, startTransition] = useTransition();

  function handleEdit() {
    setValues(saved);
    setStatus('idle');
    setIsEditing(true);
  }

  function handleCancel() {
    setValues(saved);
    setStatus('idle');
    setIsEditing(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('idle');
    startTransition(async () => {
      const { error } = await updateProfileDetails(tenantId, values);
      if (error) {
        setStatus('error');
        return;
      }
      setSaved(values);
      setStatus('saved');
      setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <div className="mt-5 space-y-3 text-sm">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between">
            <span className="text-muted">{row.label}</span>
            <span className="font-medium text-ink">{saved[row.key] || '—'}</span>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleEdit}
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm font-semibold text-ink hover:bg-ink/5 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          {status === 'saved' && <span className="text-xs text-[color:var(--color-status-active)]">Saved</span>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-3">
      <div>
        <Label>Full name</Label>
        <Input
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
        />
      </div>
      <div>
        <Label>Phone</Label>
        <Input
          type="tel"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        />
      </div>
      <div>
        <Label>DLD license</Label>
        <Input
          value={values.rera_card_no}
          onChange={(e) => setValues((v) => ({ ...v, rera_card_no: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="rounded-full px-4 py-2 text-sm font-semibold text-muted hover:bg-ink/5 transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        {status === 'error' && <span className="text-xs text-red-600">Couldn&apos;t save. Try again.</span>}
      </div>
    </form>
  );
}
