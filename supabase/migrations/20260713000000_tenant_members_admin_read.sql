-- Fixes: the admin verification page (getAdminMembers) could never see any
-- tenant members other than the admin's own row, because the only SELECT
-- policy on tenant_members was "read your own row" (tenant_members_read_own).
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
