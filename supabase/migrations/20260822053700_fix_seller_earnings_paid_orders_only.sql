-- Drop existing function first to allow return type update
DROP FUNCTION IF EXISTS public.get_seller_earnings_summary(UUID);

-- Create get_seller_earnings_summary to ONLY calculate earnings from PAID / CONFIRMED orders
CREATE OR REPLACE FUNCTION public.get_seller_earnings_summary(_seller_id UUID)
RETURNS TABLE (
  total_orders BIGINT,
  total_sales NUMERIC,
  total_commission NUMERIC,
  total_earnings NUMERIC,
  pending_payout NUMERIC,
  paid_payout NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(SUM(oi.price * oi.quantity), 0),
    COALESCE(SUM(oi.commission_amount), 0),
    COALESCE(SUM(oi.seller_earnings), 0),
    COALESCE(SUM(CASE WHEN pl.status IS NULL OR pl.status = 'pending' THEN oi.seller_earnings ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN pl.status = 'paid' THEN oi.seller_earnings ELSE 0 END), 0)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.payout_ledger pl ON pl.order_item_id = oi.id
  WHERE oi.seller_id = _seller_id
    AND (o.payment_status = 'paid' OR o.status IN ('confirmed', 'processing', 'shipped', 'delivered'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_earnings_summary(UUID) TO authenticated;
