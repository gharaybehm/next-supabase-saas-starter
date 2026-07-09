-- Team building: brokerage owners can invite agents to join their brokerage.
-- An agent's brokerage_owner_id points at the owning broker; NULL means the
-- broker is independent (or an owner themselves). Compliance (RERA card,
-- individual agreement signing, admin DLD verification) is unchanged and
-- still applies per-agent.

ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS brokerage_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.broker_profiles
  ADD CONSTRAINT broker_profiles_no_self_owner CHECK (brokerage_owner_id IS NULL OR brokerage_owner_id <> id);

CREATE INDEX IF NOT EXISTS idx_broker_profiles_owner ON public.broker_profiles(brokerage_owner_id);

-- ════ invitations: distinguish community invites from team invites ═══════════

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invite_type TEXT NOT NULL DEFAULT 'community'
    CHECK (invite_type IN ('community', 'team')),
  ADD COLUMN IF NOT EXISTS invited_by_broker_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON public.invitations(invited_by_broker_id);

-- Owners can read invitations they personally created for their team,
-- parallel to admins_read_invitations for community invites.
CREATE POLICY "owners_read_own_team_invitations"
  ON public.invitations
  FOR SELECT
  USING (invited_by_broker_id = auth.uid());

-- ════ listings / listing_images: owner can manage team members' rows ═════════

CREATE POLICY "owner_manage_team_listings"
  ON public.listings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.broker_profiles bp
      WHERE bp.id = listings.listing_broker_id
        AND bp.brokerage_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.broker_profiles bp
      WHERE bp.id = listings.listing_broker_id
        AND bp.brokerage_owner_id = auth.uid()
    )
  );

CREATE POLICY "owner_manage_team_listing_images"
  ON public.listing_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.listings l
      JOIN public.broker_profiles bp ON bp.id = l.listing_broker_id
      WHERE l.id = listing_images.listing_id
        AND bp.brokerage_owner_id = auth.uid()
    )
  );

-- ════ agreements: owner can see team members' signing/verification status ═══

CREATE POLICY "owner_read_team_agreements"
  ON public.agreements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.broker_profiles bp
      WHERE bp.id = agreements.broker_id
        AND bp.brokerage_owner_id = auth.uid()
    )
  );
