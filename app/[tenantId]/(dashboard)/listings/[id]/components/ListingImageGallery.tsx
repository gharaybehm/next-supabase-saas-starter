import { Building2 } from 'lucide-react';
import { buildImageUrl } from '@/utils/images';

interface ListingImage {
  storage_path: string;
  display_order: number;
}

interface Props {
  images: ListingImage[];
}

export default function ListingImageGallery({ images }: Props) {
  if (images.length === 0) {
    return (
      <div className="h-64 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center">
        <Building2 className="h-20 w-20 text-brand-200" />
      </div>
    );
  }

  const [primary, ...rest] = images;

  return (
    <div className="space-y-2">
      <img
        src={buildImageUrl(primary.storage_path)}
        alt="Listing photo"
        className="h-64 w-full rounded-2xl object-cover"
        loading="eager"
      />
      {rest.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rest.map((img) => (
            <img
              key={img.storage_path}
              src={buildImageUrl(img.storage_path)}
              alt="Listing photo"
              className="h-16 w-24 shrink-0 rounded-xl object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}
    </div>
  );
}
