-- Create seller-verification storage bucket for seller onboarding ID and business documents

INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-verification', 'seller-verification', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Ensure RLS policies for seller-verification bucket
DROP POLICY IF EXISTS "Authenticated users can upload seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can select seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete seller verification docs" ON storage.objects;

-- Allow authenticated users to upload verification files
CREATE POLICY "Authenticated users can upload seller verification docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'seller-verification');

-- Allow authenticated users (and admins) to read verification files
CREATE POLICY "Authenticated users can select seller verification docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'seller-verification');

-- Allow authenticated users to update verification files
CREATE POLICY "Authenticated users can update seller verification docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'seller-verification');

-- Allow authenticated users to delete verification files
CREATE POLICY "Authenticated users can delete seller verification docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'seller-verification');
