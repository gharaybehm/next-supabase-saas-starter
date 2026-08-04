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
