CREATE OR REPLACE FUNCTION public.get_order_pickup_info(_order_id uuid)
RETURNS TABLE(seller_id uuid, business_name text, address text, phone text, email text, item_count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'rider')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = _order_id AND o.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    s.sid,
    COALESCE(sp.business_name, pr.full_name, split_part(pr.email, '@', 1), 'Seller') AS business_name,
    COALESCE(NULLIF(trim(sp.business_address), ''), NULLIF(trim(sp.address), '')) AS address,
    sp.phone,
    COALESCE(sp.email, pr.email) AS email,
    s.cnt
  FROM (
    SELECT COALESCE(oi.seller_id, p.seller_id) AS sid, COUNT(*)::bigint AS cnt
    FROM public.order_items oi
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = _order_id
      AND COALESCE(oi.seller_id, p.seller_id) IS NOT NULL
    GROUP BY 1
  ) s
  LEFT JOIN public.seller_profiles sp ON sp.user_id = s.sid
  LEFT JOIN public.profiles pr ON pr.id = s.sid;
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_pickup_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_pickup_info(uuid) TO authenticated, service_role;