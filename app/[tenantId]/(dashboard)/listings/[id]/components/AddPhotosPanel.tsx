'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { addPhotosToListing } from '@/app/actions/images';
import { ImagePlus } from 'lucide-react';

interface Props {
  tenantId: string;
  listingId: string;
}

export default function AddPhotosPanel({ tenantId, listingId }: Props) {
  const t = useTranslations('listings');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addPhotosToListing(tenantId, listingId, formData);
      if (result.error) {
        setError(result.error);
      } else {
        (e.target as HTMLFormElement).reset();
        setFileCount(0);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-zinc-200/50">
      <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
        <ImagePlus className="h-4 w-4 text-zinc-400" />
        {t('images.addPhotosTitle')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="images"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
          className="block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 transition-colors"
        />
        {fileCount > 0 && (
          <p className="text-xs text-zinc-400">{fileCount} file{fileCount !== 1 ? 's' : ''} selected</p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        <button
          type="submit"
          disabled={isPending || fileCount === 0}
          className="w-full rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50 transition-colors"
        >
          {isPending ? t('images.uploadingButton') : t('images.uploadButton')}
        </button>
      </form>
    </div>
  );
}
