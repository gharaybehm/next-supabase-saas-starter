-- listings.listing_broker_id and listing_brokers.broker_id only have a foreign
-- key to auth.users(id) (the Postgres-generated default). PostgREST can't use
-- that constraint as an embedding hint to pull in user_profiles/broker_profiles
-- rows (it targets the wrong table), so listing-detail queries that try to
-- embed broker name + RERA info fail with PGRST200 ("no relationship found").
-- Add explicit FKs so PostgREST has a real relationship to embed through.

ALTER TABLE public.listings
  ADD CONSTRAINT listings_broker_user_profiles_fkey
    FOREIGN KEY (listing_broker_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.listings
  ADD CONSTRAINT listings_broker_broker_profiles_fkey
    FOREIGN KEY (listing_broker_id) REFERENCES public.broker_profiles(id);

ALTER TABLE public.listing_brokers
  ADD CONSTRAINT listing_brokers_broker_user_profiles_fkey
    FOREIGN KEY (broker_id) REFERENCES public.user_profiles(id);

ALTER TABLE public.listing_brokers
  ADD CONSTRAINT listing_brokers_broker_broker_profiles_fkey
    FOREIGN KEY (broker_id) REFERENCES public.broker_profiles(id);
