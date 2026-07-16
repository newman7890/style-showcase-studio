
-- 1. Subscribers: replace permissive INSERT with a real check.
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 3 AND 320
    AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- 2. Storage: drop broad listing SELECT policies. Public buckets serve files
-- via public URLs without needing a SELECT policy on storage.objects.
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
