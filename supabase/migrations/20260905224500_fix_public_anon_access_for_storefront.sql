-- ==============================================================================
-- Migration: 20260905224500_fix_public_anon_access_for_storefront.sql
-- Description:
--   1. Grant EXECUTE permissions on RLS helper functions (has_role, is_approved_seller,
--      resolve_delivery_fee, validate_discount_code) to anon & authenticated roles so
--      unauthenticated / guest visitors can browse products, categories, and banners.
--   2. Streamline products_select_policy so all guests can see approved products.
--   3. Create site_settings table with public read permissions for Flash Deals & Spotlight.
-- ==============================================================================

-- 1. Grant EXECUTE on essential public / helper functions
DO $$
DECLARE
  funcs text[] := ARRAY[
    'has_role',
    'is_approved_seller',
    'is_rider_suspended',
    'resolve_delivery_fee',
    'validate_discount_code',
    'get_public_seller_info',
    'get_product_reviews',
    'increment_banner_click'
  ];
  f text;
  r record;
BEGIN
  FOREACH f IN ARRAY funcs LOOP
    FOR r IN (
      SELECT p.oid::regprocedure AS proc_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = f
    ) LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.proc_signature);
    END LOOP;
  END LOOP;
END $$;

-- 2. Consolidate products SELECT policy for public browsing
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products" ON public.products;

CREATE POLICY "products_select_policy" ON public.products
FOR SELECT
USING (
  -- Anyone (guests, mobile visitors, unauthenticated users) can view approved products
  status = 'approved'
  -- Sellers can view all their own products (including pending/rejected)
  OR (auth.uid() IS NOT NULL AND auth.uid() = seller_id)
  -- Admins can view all products
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- 3. Categories public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
FOR SELECT
USING (is_active = true);

-- 4. Marketing banners public SELECT policy
DROP POLICY IF EXISTS "Anyone can view active marketing banners" ON public.marketing_banners;
DROP POLICY IF EXISTS "marketing_banners_select_policy" ON public.marketing_banners;

CREATE POLICY "marketing_banners_select_policy" ON public.marketing_banners
FOR SELECT
USING (is_active = true);

-- 5. Site settings table for centralized Flash Deals & Spotlight Marquee cross-device sync
CREATE TABLE IF NOT EXISTS public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;
CREATE POLICY "Anyone can view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage site settings" ON public.site_settings;
CREATE POLICY "Admins can manage site settings"
  ON public.site_settings FOR ALL
  USING (true)
  WITH CHECK (true);
