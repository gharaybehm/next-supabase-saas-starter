-- Create the listing-images Storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Authenticated members can read objects (belt-and-suspenders; bucket is public)
CREATE POLICY "listing_images_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'listing-images');

-- Authenticated users can insert (uploads use service role, but allow user-level too)
CREATE POLICY "listing_images_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'listing-images');
