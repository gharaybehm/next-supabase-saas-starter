-- Platform operator role, organizations and Stripe billing.
-- Run after 20261015000000_tenant_hardening.sql.
--
-- An organization holds the Stripe customer and subscription and a number of
-- tenant seats; each tenant belongs to one organization. A user who creates a
-- tenant without an organization gets a one-person organization silently
-- (app/actions/organizations.ts), so solo users never see an extra step.
--
-- 'super_admin' is the platform operator's role on user_profiles. It opens
-- /admin and grants nothing inside any tenant: the operator is not a tenant
-- member and sees counts, times and settings only.

BEGIN;

-- ─── user_profiles.role: add super_admin ─────────────────────────────────────
-- The role column is not client-writable (see the hardening migration), so
-- this value is set only by hand in Studio or with the service-role key:
--   UPDATE public.user_profiles SET role = 'super_admin' WHERE id = '<uuid>';
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'supervisor', 'worker'));

-- ─── organizations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL,
  slug                   TEXT        NOT NULL UNIQUE,
  billing_email          TEXT        NOT NULL,
  stripe_customer_id     TEXT        UNIQUE,
  stripe_subscription_id TEXT        UNIQUE,
  -- Every status Stripe can send, so a webhook write never fails the CHECK.
  subscription_status    TEXT        NOT NULL DEFAULT 'trialing'
                                      CHECK (subscription_status IN (
                                        'trialing', 'active', 'past_due', 'canceled', 'unpaid',
                                        'incomplete', 'incomplete_expired', 'paused')),
  tenant_seats           INTEGER     NOT NULL DEFAULT 3 CHECK (tenant_seats >= 0),
  created_by             UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT        NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org  ON public.organization_members(organization_id);
-- A user owns at most one organization. This is what makes the silent
-- one-person organization safe to create twice at once (two tabs, a double
-- submit): the second owner row fails and app/actions/organizations.ts
-- removes its organization. Drop it if your users need to own several.
CREATE UNIQUE INDEX IF NOT EXISTS organization_members_one_owned_per_user
  ON public.organization_members(user_id) WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);

ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- A policy on organization_members that selects from organization_members
-- recurses; asking through a SECURITY DEFINER function does not.
CREATE OR REPLACE FUNCTION public.is_organization_member(target_org uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.organization_members
     WHERE organization_id = target_org AND user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated;

-- Read-only for members. Every write goes through the service-role client:
-- server actions (gated in code) and the Stripe webhook.
DROP POLICY IF EXISTS members_read_organizations        ON public.organizations;
DROP POLICY IF EXISTS members_read_organization_members ON public.organization_members;

CREATE POLICY members_read_organizations
  ON public.organizations FOR SELECT
  USING (public.is_organization_member(id));

CREATE POLICY members_read_organization_members
  ON public.organization_members FOR SELECT
  USING (public.is_organization_member(organization_id));

REVOKE INSERT, UPDATE, DELETE ON public.organizations        FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.organization_members FROM anon, authenticated;

-- ─── tenants.organization_id ─────────────────────────────────────────────────
-- Nullable: existing tenants are not guessed into an organization. Not in the
-- client UPDATE grant, so a tenant admin cannot move a tenant to another
-- organization to get round the seat limit.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_organization ON public.tenants(organization_id);

-- The seat limit, enforced where two concurrent creates cannot both pass it:
-- the organization row is locked, so the second insert waits and then counts
-- the first. app/actions/tenants.ts checks the same thing first for a
-- friendlier message.
CREATE OR REPLACE FUNCTION public.enforce_tenant_seats()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seats integer;
  used  integer;
BEGIN
  IF NEW.organization_id IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id) THEN
    RETURN NEW;
  END IF;
  SELECT tenant_seats INTO seats FROM public.organizations WHERE id = NEW.organization_id FOR UPDATE;
  SELECT count(*) INTO used FROM public.tenants WHERE organization_id = NEW.organization_id AND id <> NEW.id;
  IF used >= seats THEN
    RAISE EXCEPTION 'Your plan''s workspace limit has been reached.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tenant_seats ON public.tenants;
CREATE TRIGGER enforce_tenant_seats
  BEFORE INSERT OR UPDATE OF organization_id ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_tenant_seats();

-- ─── stripe_invoices ─────────────────────────────────────────────────────────
-- Cache of paid invoices for the operator's payment history, written only by
-- app/api/webhooks/stripe/route.ts. Financial data: no client policy at all.
CREATE TABLE IF NOT EXISTS public.stripe_invoices (
  id                 TEXT        PRIMARY KEY, -- Stripe invoice id ("in_...")
  organization_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount_paid        INTEGER     NOT NULL,    -- smallest currency unit
  currency           TEXT        NOT NULL,
  status             TEXT        NOT NULL,
  hosted_invoice_url TEXT,
  created_at         TIMESTAMPTZ NOT NULL,    -- Stripe's invoice creation time
  synced_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_org ON public.stripe_invoices(organization_id);

ALTER TABLE public.stripe_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_invoices FROM anon, authenticated;

COMMIT;

-- AFTER RUNNING, signed in as an ordinary user who owns an organization, each
-- of these must fail or change nothing (browser console):
--   supabase.from('user_profiles').update({ role: 'super_admin' }).eq('id', myId)
--   supabase.from('organizations').update({ subscription_status: 'active', tenant_seats: 99 }).eq('id', myOrg)
--   supabase.from('organization_members').insert({ organization_id: otherOrg, user_id: myId, role: 'owner' })
--   supabase.from('tenants').update({ organization_id: otherOrg }).eq('id', myTenant)
--   supabase.from('stripe_invoices').select('*')          -- returns no rows
--   supabase.from('organizations').select('*')            -- returns only your own organization
-- And in the SQL editor, for an organization already at its seat count, this
-- must fail with "workspace limit has been reached":
--   INSERT INTO public.tenants (name, slug, created_by, organization_id)
--   VALUES ('x', 'seat-check-x', '<user id>', '<org id>');
