DROP POLICY IF EXISTS "Sellers upload own verification docs" ON storage.objects;
CREATE POLICY "Sellers upload own verification docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'seller-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Sellers read own verification docs" ON storage.objects;
CREATE POLICY "Sellers read own verification docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'seller-verification'
  AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'))
);

DROP POLICY IF EXISTS "Sellers update own verification docs" ON storage.objects;
CREATE POLICY "Sellers update own verification docs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'seller-verification' AND (storage.foldername(name))[1] = auth.uid()::text);
