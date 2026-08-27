-- Fix: Allow authenticated users to insert & update their profile and avatar photos in storage

-- 1. Fix profiles table RLS policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Fix avatars storage bucket RLS policies on storage.objects
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatar" ON storage.objects;
CREATE POLICY "Users can upload avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1] IS NULL
      OR name LIKE auth.uid()::text || '/%'
      OR name LIKE 'avatar_' || auth.uid()::text || '%'
    )
  );

DROP POLICY IF EXISTS "Users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1] IS NULL
      OR name LIKE auth.uid()::text || '/%'
      OR name LIKE 'avatar_' || auth.uid()::text || '%'
    )
  );

DROP POLICY IF EXISTS "Users can delete their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (storage.foldername(name))[1] IS NULL
      OR name LIKE auth.uid()::text || '/%'
      OR name LIKE 'avatar_' || auth.uid()::text || '%'
    )
  );
