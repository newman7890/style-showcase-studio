-- ==============================================================================
-- Migration: Secure Storage Policies & Profile Privacy (Phase 3 Security Hardening)
-- ==============================================================================

-- 1. HARDEN SELLER-VERIFICATION BUCKET (ID documents, business certificates, tax docs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('seller-verification', 'seller-verification', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Drop all overly permissive policies on seller-verification
DROP POLICY IF EXISTS "Authenticated users can upload seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can select seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete seller verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins read seller-verification objects" ON storage.objects;
DROP POLICY IF EXISTS "Sellers upload own verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Sellers read own verification docs" ON storage.objects;
DROP POLICY IF EXISTS "Sellers update own verification docs" ON storage.objects;

-- Strict: Sellers can ONLY upload into their own folder (userId/...)
CREATE POLICY "Sellers upload own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seller-verification' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Strict: Only the document owner OR an administrator can read verification docs
CREATE POLICY "Sellers and admins read own verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'seller-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Strict: Only the document owner OR an administrator can update verification docs
CREATE POLICY "Sellers and admins update own verification docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'seller-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Strict: Only the document owner OR an administrator can delete verification docs
CREATE POLICY "Sellers and admins delete own verification docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'seller-verification'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 2. HARDEN PRODUCT-IMAGES BUCKET (Prevent malicious deletion/overwrite of seller photos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete product images" ON storage.objects;

-- Allow public viewing of product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

-- Allow authenticated users to upload new product photos
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow only owners and admins to update existing product photos
CREATE POLICY "Admins and owners can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR owner = auth.uid()
  )
);

-- Allow only owners and admins to delete existing product photos
CREATE POLICY "Admins and owners can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR name LIKE auth.uid()::text || '/%'
    OR owner = auth.uid()
  )
);

-- 3. HARDEN PROFILES TABLE (Prevent customer email address harvesting)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Users can only view their own profile, or admins can view all profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Create a safe public view that exposes ONLY non-sensitive fields (No email or phone)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT 
  id,
  full_name,
  avatar_url,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
