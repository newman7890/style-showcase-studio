-- Enhance marketing_banners table with placement and click tracking
ALTER TABLE public.marketing_banners 
ADD COLUMN IF NOT EXISTS placement TEXT DEFAULT 'deal_cards',
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- Ensure RLS allows incrementing click count or viewing for users
DROP POLICY IF EXISTS "Anyone can update click_count on marketing banners" ON public.marketing_banners;
CREATE POLICY "Anyone can update click_count on marketing banners"
  ON public.marketing_banners FOR UPDATE
  USING (true)
  WITH CHECK (true);
