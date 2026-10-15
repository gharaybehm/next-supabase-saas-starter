-- Tenant isolation and role hardening.
-- Run via: supabase db push, or paste into Supabase Studio → SQL Editor.
-- Safe to run on a fresh project (after the core schema) and on one that
-- already has the core schema and data.
--
-- WHAT THIS FIXES IN THE CORE SCHEMA
--   1. user_profiles: the owner's FOR ALL policy had no column limit, so any
--      signed-in user could set their own `role` (later 'super_admin') from
--      the browser, or insert their profile with any role.
--   2. user_profiles / tenant_members: members could read only their own rows,
--      so the Team tab showed only the caller and names never resolved.
--   3. tenants: no UPDATE policy, so the settings form silently changed
--      nothing; and nothing limited which columns a client may write.
--   4. push_subscriptions: a user could subscribe to another tenant's alerts.
--   5. No profile was created for users made outside the app (Studio, the
--      admin API); the app inserted one from the browser session instead.
--
-- All membership and tenant-creation writes go through the service-role
-- client in server actions (app/actions/*), which bypasses RLS and gates with
-- requireTenantRole() in utils/supabase/tenant-access.ts. RLS here is the
-- second line of defence and must express the same matrix.
--
-- NOTE FOR LATER MIGRATIONS: user_profiles and tenants use column-level
-- INSERT/UPDATE grants. A column added to either is not writable by signed-in
-- users until granted, e.g.  GRANT UPDATE (new_column) ON public.tenants TO authenticated;

BEGIN;

-- ─── Helpers ─────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so a policy can ask about membership without the policy on
-- tenant_members applying to the question (which would recurse).

CREATE OR REPLACE FUNCTION public.is_tenant_member(target_tenant uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_tenant IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_members
     WHERE tenant_id = target_tenant AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(target_tenant uuid, allowed text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT target_tenant IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_members
     WHERE tenant_id = target_tenant
       AND user_id = auth.uid()
       AND role = ANY (allowed)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, text[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_tenant_member(uuid)        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.has_tenant_role(uuid, text[]) TO authenticated;

-- ─── 1 + 2. user_profiles ────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_own_profile                ON public.user_profiles;
DROP POLICY IF EXISTS profiles_select_self_or_comember ON public.user_profiles;
DROP POLICY IF EXISTS profiles_insert_self             ON public.user_profiles;
DROP POLICY IF EXISTS profiles_update_self             ON public.user_profiles;

CREATE POLICY profiles_select_self_or_comember
  ON public.user_profiles FOR SELECT
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
        FROM public.tenant_members me
        JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
       WHERE me.user_id = auth.uid()
         AND them.user_id = public.user_profiles.id
    )
  );

CREATE POLICY profiles_insert_self
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_self
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- The role column is never client-writable: it takes its default on insert and
-- changes only through the service-role client.
REVOKE INSERT, UPDATE, DELETE ON public.user_profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, phone)        ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON public.user_profiles TO authenticated;

-- ─── 2. tenant_members: co-members can see each other; no client writes ──────
DROP POLICY IF EXISTS tenant_members_read_own       ON public.tenant_members;
DROP POLICY IF EXISTS tenant_members_read_comembers ON public.tenant_members;

CREATE POLICY tenant_members_read_comembers
  ON public.tenant_members FOR SELECT
  USING (public.is_tenant_member(tenant_id));

REVOKE INSERT, UPDATE, DELETE ON public.tenant_members FROM anon, authenticated;

-- A tenant always keeps at least one admin. Enforced here rather than only in
-- app/actions/team.ts because two admins demoting each other at the same
-- moment both pass a check made in code. Locking the tenant row makes the
-- second change wait and then see the first.
CREATE OR REPLACE FUNCTION public.keep_one_tenant_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role <> 'admin' OR (TG_OP = 'UPDATE' AND NEW.role = 'admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  -- The tenant or the user is being deleted (a cascade): nothing to keep.
  PERFORM 1 FROM public.tenants WHERE id = OLD.tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_members
     WHERE tenant_id = OLD.tenant_id AND role = 'admin' AND user_id <> OLD.user_id
  ) THEN
    RAISE EXCEPTION 'A workspace must keep at least one admin.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS keep_one_tenant_admin ON public.tenant_members;
CREATE TRIGGER keep_one_tenant_admin
  BEFORE UPDATE OF role OR DELETE ON public.tenant_members
  FOR EACH ROW EXECUTE FUNCTION public.keep_one_tenant_admin();

-- ─── 3. tenants: admins edit name and description; nothing else ──────────────
DROP POLICY IF EXISTS tenant_admins_update ON public.tenants;

CREATE POLICY tenant_admins_update
  ON public.tenants FOR UPDATE
  USING (public.has_tenant_role(id, ARRAY['admin']))
  WITH CHECK (public.has_tenant_role(id, ARRAY['admin']));

REVOKE INSERT, UPDATE, DELETE ON public.tenants FROM anon, authenticated;
GRANT UPDATE (name, description, updated_at) ON public.tenants TO authenticated;

-- ─── 4. push_subscriptions: only for tenants the user belongs to ─────────────
DROP POLICY IF EXISTS users_own_push_subscriptions ON public.push_subscriptions;

CREATE POLICY users_own_push_subscriptions
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.is_tenant_member(tenant_id));

-- ─── 5. A profile for every auth user ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill users created before the trigger existed.
INSERT INTO public.user_profiles (id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1))
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id);

COMMIT;

-- AFTER RUNNING, signed in as an ordinary member, each of these must fail or
-- return only rows of the member's own tenants (browser console):
--   supabase.from('user_profiles').update({ role: 'admin' }).eq('id', myId)
--   supabase.from('tenant_members').insert({ tenant_id: otherTenant, user_id: myId, role: 'admin' })
--   supabase.from('tenants').insert({ name: 'x', slug: 'x', created_by: myId })
--   supabase.from('push_subscriptions').insert({ tenant_id: otherTenant, user_id: myId, endpoint: 'x', p256dh: 'x', auth: 'x' })
-- And in the SQL editor, on a tenant with a single admin, this must fail:
--   UPDATE public.tenant_members SET role = 'worker' WHERE tenant_id = '<id>' AND role = 'admin';
