DROP POLICY IF EXISTS "Seller applicants can upload own store logos" ON storage.objects;
CREATE POLICY "Seller applicants can upload own store logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'store-logos'
  AND (storage.foldername(name))[2] = auth.uid()::text
);