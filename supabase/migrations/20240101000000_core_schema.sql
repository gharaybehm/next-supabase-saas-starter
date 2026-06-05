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
