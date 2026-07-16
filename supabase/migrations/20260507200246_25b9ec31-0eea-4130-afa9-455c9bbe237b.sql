CREATE OR REPLACE FUNCTION public.get_product_reviews(_product_id uuid)
RETURNS TABLE (
  id uuid,
  rating integer,
  comment text,
  created_at timestamptz,
  full_name text,
  avatar_url text,
  is_own boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.rating,
    r.comment,
    r.created_at,
    p.full_name,
    p.avatar_url,
    (auth.uid() IS NOT NULL AND auth.uid() = r.user_id) AS is_own
  FROM public.product_reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.product_id = _product_id
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid) TO anon, authenticated;

-- Restrict public read of user_id column on product_reviews
REVOKE SELECT ON public.product_reviews FROM anon, authenticated;
GRANT SELECT (id, product_id, rating, comment, created_at, updated_at) ON public.product_reviews TO anon, authenticated;
GRANT SELECT (user_id) ON public.product_reviews TO authenticated;

-- Tighten RLS so only owners and admins can SELECT rows that include user_id via direct table access
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.product_reviews;

CREATE POLICY "Owners can view their reviews"
ON public.product_reviews
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews"
ON public.product_reviews
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
