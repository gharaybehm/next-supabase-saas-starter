-- Private bucket for DLD broker license documents. Unlike listing-images
-- (public), this bucket must stay private: access is restricted by RLS
-- storage policies to admins and the owning broker only, and files are
-- served via short-lived signed URLs generated server-side.
INSERT INTO storage.buckets (id, name, public)
VALUES ('dld-licenses', 'dld-licenses', false)
ON CONFLICT (id) DO NOTHING;

-- Object key convention: {tenant_id}/{broker_user_id}/{uuid}.{ext}

-- Owning broker can upload/read/replace their own license
CREATE POLICY "dld_license_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'dld-licenses' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "dld_license_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'dld-licenses' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "dld_license_owner_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'dld-licenses' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "dld_license_owner_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'dld-licenses' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Tenant admins can read any broker's license in that tenant
CREATE POLICY "dld_license_admin_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dld-licenses'
    AND EXISTS (
      SELECT 1 FROM public.tenant_members
      WHERE tenant_members.tenant_id::text = (storage.foldername(name))[1]
        AND tenant_members.user_id = auth.uid()
        AND tenant_members.role = 'admin'
    )
  );

-- Path to the uploaded license file (nullable: pre-existing brokers have none,
-- and "required" for new registrations is enforced at the application layer).
ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS dld_license_path TEXT;

-- Anchor date for the annual renewal prompt: last time the broker uploaded
-- (or renewed) their license. Null means never uploaded -> renewal is due.
ALTER TABLE public.broker_profiles
  ADD COLUMN IF NOT EXISTS dld_license_renewed_at TIMESTAMPTZ;
