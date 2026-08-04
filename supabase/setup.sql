-- ════════════════════════════════════════════════════════════════════════════
-- next-supabase-saas-starter — Full Database Setup
-- Paste this entire file into Supabase Studio → SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════════════

-- Core schema for next-supabase-saas-starter
-- Run via: supabase db push
-- Or paste into Supabase Studio → SQL Editor

-- ─── user_profiles ─────────────────────────────────────────────────────────────
-- Extends Supabase auth.users with a display name and role.

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

-- ─── tenants ───────────────────────────────────────────────────────────────────
-- A "tenant" is an isolated workspace. Users can belong to multiple tenants.

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

-- Only members of a tenant can see it
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

-- ─── tenant_members ────────────────────────────────────────────────────────────
-- Join table: which users belong to which tenant, and at what role.

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

-- Members can read their own membership rows
CREATE POLICY "tenant_members_read_own"
  ON public.tenant_members
  FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_tm_tenant ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tm_user   ON public.tenant_members(user_id);

-- ─── push_subscriptions ────────────────────────────────────────────────────────
-- One row per browser/device per user per tenant.

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


-- Admin scaffolding: invitations, audit log, API keys, and the RLS helper
-- that lets tenant admins see other members (not just their own row).
-- Applies on top of 20240101000000_core_schema.sql

-- ════ invitations ═════════════════════════════════════════════════════════════
-- Admin-generated invite tokens for onboarding new tenant members

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

-- Admins of a tenant can read invitations for that tenant
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

-- Anyone can read a single invitation by token (for the invite accept page)
-- This is enforced at the application layer via service role

-- ════ audit_logs ══════════════════════════════════════════════════════════════
-- Immutable append-only event log for admin actions

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

-- Admins can read audit logs for their tenant
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

CREATE INDEX IF NOT EXISTS idx_audit_tenant  ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor   ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at DESC);

-- ════ api_keys ════════════════════════════════════════════════════════════════
-- Tenant-scoped API keys for programmatic access

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

-- ════ user_profiles: generic notification preference ═════════════════════════

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT true;

-- ════ tenant_members / user_profiles: let admins see other members ═══════════
-- A policy on tenant_members can't reference tenant_members directly in its
-- USING clause without infinite recursion, so route the admin check through
-- a SECURITY DEFINER function, which runs with RLS bypassed internally.

CREATE OR REPLACE FUNCTION public.is_tenant_admin(check_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE tenant_id = check_tenant_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE POLICY "tenant_members_admin_read_all"
  ON public.tenant_members
  FOR SELECT
  USING (public.is_tenant_admin(tenant_id));

-- user_profiles has no tenant_id column, so admin-ness is checked by joining
-- through tenant_members: the caller must be an admin of some tenant that
-- the target profile's user also belongs to.
CREATE POLICY "user_profiles_admin_read_tenant"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members admin_tm
      JOIN public.tenant_members target_tm ON target_tm.tenant_id = admin_tm.tenant_id
      WHERE admin_tm.user_id = auth.uid()
        AND admin_tm.role = 'admin'
        AND target_tm.user_id = user_profiles.id
    )
  );


-- Billing schema: tenant-level Stripe subscriptions
-- Applies on top of 20240102000000_mls_schema.sql

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID    NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  status                 TEXT    NOT NULL DEFAULT 'incomplete'
                         CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled', 'unpaid')),
  current_period_end     TIMESTAMPTZ,
  grace_period_ends_at   TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenant members can read their own tenant's subscription status
CREATE POLICY "members_read_subscription"
  ON public.subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id = subscriptions.tenant_id
        AND tenant_members.user_id = auth.uid()
    )
  );

-- Writes (checkout, webhook sync) happen exclusively via the service-role client

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON public.subscriptions(stripe_subscription_id);
