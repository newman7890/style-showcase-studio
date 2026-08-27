-- Fix: Ensure subscribers table allows anonymous inserts for newsletter signups
-- Drop all existing insert policies and recreate with a permissive policy
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.subscribers;

CREATE POLICY "Anyone can subscribe to newsletter"
  ON public.subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
