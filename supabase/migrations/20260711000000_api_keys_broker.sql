-- Ties an API key to a specific broker so API-created listings/photos can be
-- attributed to that broker (listing_broker_id) and gated by their signed
-- Co-Brokerage Agreement, same as the manual "New Listing" flow. Nullable:
-- existing tenant-wide keys keep working for the read-only v1 routes.
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS broker_id UUID
    CONSTRAINT api_keys_broker_id_fkey REFERENCES auth.users(id);
