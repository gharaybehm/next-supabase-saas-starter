-- Tracks which storage backend hosts each image, so the Filebase backfill
-- (scripts/migrate-images-to-filebase.ts) can safely skip already-migrated
-- rows and buildImageUrl callers can distinguish provider during cutover.
ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'supabase';
