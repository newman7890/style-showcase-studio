
-- 1) Remove overly permissive public SELECT on seller_profiles
DROP POLICY IF EXISTS "Public can view approved sellers" ON public.seller_profiles;

-- 2) Safe public view: only non-sensitive fields for approved sellers
CREATE OR REPLACE VIEW public.public_sellers
WITH (security_invoker = true) AS
SELECT user_id, business_name, bio, approved_at
FROM public.seller_profiles
WHERE status = 'approved';

GRANT SELECT ON public.public_sellers TO anon, authenticated;

-- 3) Harden earnings RPC
CREATE OR REPLACE FUNCTION public.get_seller_earnings_summary(_seller_id uuid)
 RETURNS TABLE(total_orders bigint, total_gross numeric, total_commission numeric, total_earnings numeric, pending_earnings numeric, paid_earnings numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _seller_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT oi.order_id)::BIGINT,
    COALESCE(SUM(oi.unit_price * oi.quantity),0),
    COALESCE(SUM(oi.commission_amount),0),
    COALESCE(SUM(oi.seller_earnings),0),
    COALESCE(SUM(CASE WHEN pl.status IS NULL OR pl.status = 'pending' THEN oi.seller_earnings ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN pl.status = 'paid' THEN oi.seller_earnings ELSE 0 END),0)
  FROM public.order_items oi
  LEFT JOIN public.payout_ledger pl ON pl.order_item_id = oi.id
  WHERE oi.seller_id = _seller_id;
END;
$function$;
