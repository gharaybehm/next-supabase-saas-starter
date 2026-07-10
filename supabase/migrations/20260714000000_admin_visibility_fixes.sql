-- Continuation of 20260713000000: fixing tenant_members RLS alone wasn't
-- enough to make the admin verification page show brokers. Two more layers
-- were blocking it:
--
-- 1. user_profiles and agreements only had "read your own row" SELECT
--    policies, so an admin querying other members' names/agreement status
--    got nothing back for anyone but themselves.
-- 2. (Fixed in application code, not here: PostgREST couldn't auto-embed
--    tenant_members -> user_profiles/broker_profiles/agreements in a single
--    nested select, because those tables only share a common ancestor
--    (auth.users) rather than a direct foreign key to tenant_members.
--    getAdminMembers() now fetches each table separately and merges in JS.)

-- agreements has a tenant_id column directly, so this can reuse the
-- is_tenant_admin() helper from 20260713000000_tenant_members_admin_read.sql.
CREATE POLICY "agreements_admin_read_tenant"
  ON public.agreements
  FOR SELECT
  USING (public.is_tenant_admin(tenant_id));

-- user_profiles has no tenant_id column, so admin-ness is checked by joining
-- through tenant_members: the caller must be an admin of some tenant that
-- the target profile's user also belongs to. This queries tenant_members
-- (a different table), not user_profiles itself, so it's not recursive.
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
