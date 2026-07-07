-- Rabita rebrand: notification preferences, broker verification status,
-- and per-listing commission-split snapshot.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS notify_new_listings BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_deal_updates BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_monthly_statements BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));

-- Backfill from the existing boolean so already-verified brokers aren't
-- shown as pending in the new Admin verification screen.
UPDATE public.broker_profiles SET verification_status = 'verified' WHERE dld_verified = true AND verification_status = 'pending';

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS split_listing_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS split_cooperating_pct NUMERIC(5,2);

-- Snapshot the tenant's current global config onto existing listings so
-- they keep their original split even if the admin later changes the default.
UPDATE public.listings l
SET split_listing_pct = c.listing_pct,
    split_cooperating_pct = c.cooperating_pct
FROM public.commission_config c
WHERE l.tenant_id = c.tenant_id
  AND l.split_listing_pct IS NULL;
