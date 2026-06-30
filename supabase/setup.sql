-- ════════════════════════════════════════════════════════════════════════════
-- Micro MLS — Full Database Setup
-- Paste this entire file into Supabase Studio → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════════════


-- ── PART 1: Core schema (tenants, users, push) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT,
  phone      TEXT,
  role       TEXT        NOT NULL DEFAULT 'worker'
                         CHECK (role IN ('admin', 'supervisor', 'worker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_profile"
  ON public.user_profiles
  FOR ALL
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.tenants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL UNIQUE,
  description TEXT,
  created_by  UUID        NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_can_read"
  ON public.tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = tenants.id
        AND tenant_members.user_id   = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.tenant_members (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'worker'
                         CHECK (role IN ('admin', 'supervisor', 'worker')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_members_read_own"
  ON public.tenant_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tm_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tm_user   ON public.tenant_members(user_id);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id)      ON DELETE CASCADE,
  tenant_id  UUID        NOT NULL REFERENCES public.tenants(id)  ON DELETE CASCADE,
  endpoint   TEXT        NOT NULL UNIQUE,
  p256dh     TEXT        NOT NULL,
  auth       TEXT        NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_push_subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ps_tenant ON public.push_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ps_user   ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ps_ep     ON public.push_subscriptions(endpoint);


-- ── PART 2: MLS schema ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broker_profiles (
  id                 UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rera_card_no       TEXT    NOT NULL,
  brokerage_name     TEXT    NOT NULL,
  trade_license_no   TEXT,
  dld_verified       BOOLEAN NOT NULL DEFAULT false,
  agreement_status   TEXT    NOT NULL DEFAULT 'pending'
                             CHECK (agreement_status IN ('pending', 'sent', 'viewed', 'signed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_can_read_profiles"
  ON public.broker_profiles
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "brokers_own_profile"
  ON public.broker_profiles
  FOR ALL
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE TABLE IF NOT EXISTS public.invitations (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  token        TEXT    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  email        TEXT    NOT NULL,
  tenant_id    UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role         TEXT    NOT NULL DEFAULT 'worker'
                       CHECK (role IN ('admin', 'supervisor', 'worker')),
  created_by   UUID    NOT NULL REFERENCES auth.users(id),
  used_at      TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_invitations"
  ON public.invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = invitations.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'admin'
    )
  );

CREATE TABLE IF NOT EXISTS public.agreements (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id         UUID    NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id         UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  signature_request_id TEXT,
  status            TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  signed_at         TIMESTAMPTZ,
  audit_trail       JSONB   NOT NULL DEFAULT '[]'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_own_agreement"
  ON public.agreements
  FOR SELECT
  USING (broker_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID    REFERENCES public.tenants(id) ON DELETE SET NULL,
  actor_id    UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_read_audit_logs"
  ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = audit_logs.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_audit_tenant    ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created   ON public.audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.commission_config (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID    NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_pct       NUMERIC(5,2) NOT NULL DEFAULT 50.00
                    CHECK (listing_pct BETWEEN 0 AND 100),
  cooperating_pct   NUMERIC(5,2) NOT NULL DEFAULT 50.00
                    CHECK (cooperating_pct BETWEEN 0 AND 100),
  updated_by        UUID    REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_commission"
  ON public.commission_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = commission_config.tenant_id
        AND tenant_members.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.listings (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_broker_id  UUID    NOT NULL REFERENCES auth.users(id),
  area               TEXT    NOT NULL,
  sub_community      TEXT,
  property_type      TEXT    NOT NULL
                     CHECK (property_type IN ('apartment','villa','townhouse','office','retail','warehouse','land','penthouse','duplex','other')),
  price_aed          BIGINT  NOT NULL CHECK (price_aed > 0),
  size_sqft          NUMERIC(10,2) NOT NULL CHECK (size_sqft > 0),
  bedrooms           SMALLINT NOT NULL DEFAULT 0 CHECK (bedrooms >= 0),
  bathrooms          SMALLINT NOT NULL CHECK (bathrooms >= 0),
  description_en     TEXT,
  description_ar     TEXT,
  dld_permit_no      TEXT    NOT NULL,
  status             TEXT    NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','pending','sold','expired')),
  virtual_tour_url   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_listings"
  ON public.listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = listings.tenant_id
        AND tenant_members.user_id = auth.uid()
    )
  );

CREATE POLICY "broker_manage_own_listings"
  ON public.listings
  FOR ALL
  USING  (listing_broker_id = auth.uid())
  WITH CHECK (listing_broker_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_listings_tenant   ON public.listings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_listings_broker   ON public.listings(listing_broker_id);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_area     ON public.listings(area);
CREATE INDEX IF NOT EXISTS idx_listings_type     ON public.listings(property_type);

CREATE TABLE IF NOT EXISTS public.listing_brokers (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID    NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  broker_id   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT    NOT NULL DEFAULT 'co-listing'
              CHECK (role IN ('listing','co-listing')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, broker_id)
);

ALTER TABLE public.listing_brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_listing_brokers"
  ON public.listing_brokers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      JOIN public.tenant_members tm ON tm.tenant_id = l.tenant_id
      WHERE l.id = listing_brokers.listing_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_lb_listing ON public.listing_brokers(listing_id);
CREATE INDEX IF NOT EXISTS idx_lb_broker  ON public.listing_brokers(broker_id);

CREATE TABLE IF NOT EXISTS public.listing_images (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id   UUID    NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  storage_path TEXT    NOT NULL,
  width        INT,
  height       INT,
  size_bytes   BIGINT,
  original_name TEXT,
  display_order SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_listing_images"
  ON public.listing_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      JOIN public.tenant_members tm ON tm.tenant_id = l.tenant_id
      WHERE l.id = listing_images.listing_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "broker_manage_own_listing_images"
  ON public.listing_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      WHERE l.id = listing_images.listing_id
        AND l.listing_broker_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_li_listing ON public.listing_images(listing_id);

CREATE TABLE IF NOT EXISTS public.deals (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  listing_id               UUID    NOT NULL REFERENCES public.listings(id),
  listing_broker_id        UUID    NOT NULL REFERENCES auth.users(id),
  cooperating_broker_id    UUID    REFERENCES auth.users(id),
  listing_commission_pct   NUMERIC(5,2) NOT NULL,
  cooperating_commission_pct NUMERIC(5,2),
  closed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  commission_statement_path TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_deals"
  ON public.deals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = deals.tenant_id
        AND tenant_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_deals_tenant  ON public.deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_listing ON public.deals(listing_id);

CREATE TABLE IF NOT EXISTS public.conversations (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  participant_ids  UUID[]  NOT NULL,
  listing_id       UUID    REFERENCES public.listings(id) ON DELETE SET NULL,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_read_conversations"
  ON public.conversations
  FOR SELECT
  USING (auth.uid() = ANY(participant_ids));

CREATE POLICY "participants_manage_conversations"
  ON public.conversations
  FOR ALL
  USING  (auth.uid() = ANY(participant_ids))
  WITH CHECK (auth.uid() = ANY(participant_ids));

CREATE INDEX IF NOT EXISTS idx_conv_tenant ON public.conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_last   ON public.conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID    NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id        UUID    NOT NULL REFERENCES auth.users(id),
  body             TEXT    NOT NULL CHECK (char_length(body) > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "participants_read_messages"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() = ANY(c.participant_ids)
    )
  );

CREATE POLICY "sender_insert_messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND auth.uid() = ANY(c.participant_ids)
    )
  );

CREATE INDEX IF NOT EXISTS idx_msg_conv    ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_msg_created ON public.messages(created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  key_hash     TEXT    NOT NULL UNIQUE,
  created_by   UUID    NOT NULL REFERENCES auth.users(id),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_api_keys"
  ON public.api_keys
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = api_keys.tenant_id
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_apikeys_tenant ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash   ON public.api_keys(key_hash);
