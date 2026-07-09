-- Sale vs. rental distinction for listings, plus a matching "rented" terminal status.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (transaction_type IN ('sale', 'rent'));

CREATE INDEX IF NOT EXISTS idx_listings_transaction_type ON public.listings(transaction_type);

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_status_check;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
    CHECK (status IN ('active', 'pending', 'sold', 'rented', 'expired'));
