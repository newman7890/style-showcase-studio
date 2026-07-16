-- Add flash sale columns to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS sale_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamp with time zone DEFAULT NULL;

-- Create shared wishlists table for wishlist sharing
CREATE TABLE IF NOT EXISTS public.shared_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  share_token text NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 12),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_wishlists ENABLE ROW LEVEL SECURITY;

-- Users can manage their own shared wishlists
CREATE POLICY "Users can manage own shared wishlists"
  ON public.shared_wishlists FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can view shared wishlists by token (for public access)
CREATE POLICY "Anyone can view shared wishlists"
  ON public.shared_wishlists FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public to view favorites for shared wishlists
CREATE POLICY "Public can view favorites via shared wishlist"
  ON public.favorites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_wishlists sw
      WHERE sw.user_id = favorites.user_id
    )
  );
