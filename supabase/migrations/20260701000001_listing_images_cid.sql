-- Filebase serves objects via IPFS gateway URLs keyed by content identifier
-- (CID), not by storage_path — this column stores that CID once an image is
-- migrated/uploaded to Filebase. Nullable since 'supabase' rows have none.
ALTER TABLE public.listing_images
  ADD COLUMN IF NOT EXISTS cid TEXT;
