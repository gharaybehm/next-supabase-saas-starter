-- Mobile "Message Broker" deep-link needs the listing broker's phone number,
-- read directly by the RLS-scoped client (no server-side admin proxy exists
-- on mobile). user_profiles today only allows reading your own row
-- ("users_own_profile"), so cross-broker reads must be added explicitly.
-- Scoped to tenant-mates only, mirroring broker_profiles' existing
-- "brokers_can_read_profiles" community-directory policy.

CREATE POLICY "tenant_members_read_profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_members me
      JOIN public.tenant_members them ON them.tenant_id = me.tenant_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = user_profiles.id
    )
  );
