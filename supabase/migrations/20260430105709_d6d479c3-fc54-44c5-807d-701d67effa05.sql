-- 1. Fix favorites: remove public policy, replace with token-based function
DROP POLICY IF EXISTS "Public can view favorites via shared wishlist" ON public.favorites;

CREATE OR REPLACE FUNCTION public.get_shared_wishlist(_token text)
RETURNS TABLE (
  product_id uuid,
  id uuid,
  name text,
  price numeric,
  image text,
  owner_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    f.product_id,
    p.id,
    p.name,
    p.price,
    p.image,
    pr.full_name AS owner_name
  FROM public.shared_wishlists sw
  JOIN public.favorites f ON f.user_id = sw.user_id
  JOIN public.products p ON p.id = f.product_id
  LEFT JOIN public.profiles pr ON pr.id = sw.user_id
  WHERE sw.share_token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_wishlist(text) TO anon, authenticated;

-- 2. Fix orders: remove public tracking policy, create safe function
DROP POLICY IF EXISTS "Anyone can view orders by tracking code" ON public.orders;

CREATE OR REPLACE FUNCTION public.get_order_by_tracking_code(_tracking_code text)
RETURNS TABLE (
  id uuid,
  tracking_code text,
  status text,
  total_amount numeric,
  currency text,
  shipping_city text,
  shipping_region text,
  shipping_name_masked text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.tracking_code,
    o.status,
    o.total_amount,
    o.currency,
    o.shipping_city,
    o.shipping_region,
    -- Mask name: first letter + last name initial
    CASE
      WHEN o.shipping_name IS NULL OR length(trim(o.shipping_name)) = 0 THEN ''
      ELSE substring(o.shipping_name, 1, 1) || '***'
    END AS shipping_name_masked,
    o.created_at,
    o.updated_at
  FROM public.orders o
  WHERE o.tracking_code = upper(trim(_tracking_code))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_code(text) TO anon, authenticated;

-- 3. Realtime: ensure orders table replica identity does not leak
-- The realtime postgres_changes feature respects RLS on the source table when
-- the subscriber is authenticated. With the public orders policy removed,
-- only admins, riders, and order owners can receive change events.
-- No further action required on realtime.messages (managed by Supabase).