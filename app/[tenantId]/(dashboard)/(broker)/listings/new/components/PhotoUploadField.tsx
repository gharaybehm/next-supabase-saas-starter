'use client';

import { useRef, useState } from 'react';
import { X } from 'lucide-react';

export default function PhotoUploadField() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);

  function syncInput(next: File[]) {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(next);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    syncInput([...files, ...selected]);
  }

  function handleRemove(index: number) {
    syncInput(files.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {files.map((file, i) => {
          const url = URL.createObjectURL(file);
          return (
            <div key={`${file.name}-${i}`} className="group relative aspect-square overflow-hidden rounded-xl border border-ink/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        <label className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-ink/15 bg-canvas text-xs text-muted hover:border-terracotta/40 hover:text-terracotta transition-colors">
          Add photo
          <input
            ref={inputRef}
            name="images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </div>

      {files.length > 0 && (
        <p className="mt-2 text-xs text-muted">{files.length} photo{files.length !== 1 ? 's' : ''} selected</p>
      )}
    </div>
  );
}
