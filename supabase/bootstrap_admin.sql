-- ════════════════════════════════════════════════════════════════════════════
-- next-supabase-saas-starter — Admin Bootstrap
--
-- Run this AFTER:
--   1. setup.sql has been applied
--   2. You've created your admin user in Supabase Auth (Email → Sign Up)
--      and confirmed their email
--
-- Steps:
--   1. Go to Supabase → Authentication → Users
--   2. Copy your user's UUID
--   3. Replace <YOUR_USER_UUID> below with that UUID
--   4. Paste this file into SQL Editor → Run
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user_id   UUID := '<YOUR_USER_UUID>';  -- ← paste your UUID here
  v_tenant_id UUID;
BEGIN

  -- 1. Create or update user profile with admin role
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (v_user_id, 'Platform Admin', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';

  -- 2. Create the first tenant
  INSERT INTO public.tenants (name, slug, description, created_by)
  VALUES ('Default Workspace', 'default', 'First tenant workspace', v_user_id)
  RETURNING id INTO v_tenant_id;

  -- 3. Add admin as a tenant member with admin role
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_user_id, 'admin');

  -- 4. Mark the bootstrap tenant as an active subscription so the admin
  --    isn't immediately locked out by the billing gate. Tenants created
  --    afterwards must subscribe via /<tenantId>/billing.
  INSERT INTO public.subscriptions (tenant_id, status)
  VALUES (v_tenant_id, 'active');

  RAISE NOTICE 'Bootstrap complete. Tenant ID: %', v_tenant_id;
END $$;
