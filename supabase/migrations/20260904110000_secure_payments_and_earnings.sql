-- ==============================================================================
-- Migration: Secure Payments & Seller Earnings Calculation (Phase 1 Security Hardening)
-- ==============================================================================

-- 1. Restrict record_order_seller_earnings so only trusted backend/service_role processes can run it
REVOKE EXECUTE ON FUNCTION public.record_order_seller_earnings(UUID) FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.record_order_seller_earnings(_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item RECORD;
  _product_seller UUID;
  _authoritative_price NUMERIC(10,2);
  _commission_rate NUMERIC(5,2) := 0.10; -- 10% platform commission
  _item_total NUMERIC(10,2);
  _fee NUMERIC(10,2);
  _net NUMERIC(10,2);
BEGIN
  -- For each item in the order, look up the authoritative price and owning seller
  FOR _item IN 
    SELECT oi.id AS item_id, oi.product_id, oi.quantity, oi.price AS client_price
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    SELECT seller_id, price INTO _product_seller, _authoritative_price
    FROM public.products
    WHERE id = _item.product_id;

    IF _product_seller IS NOT NULL THEN
      -- Use authoritative product catalog price to calculate platform fees and earnings
      _item_total := COALESCE(_authoritative_price, _item.client_price) * _item.quantity;
      _fee := ROUND(_item_total * _commission_rate, 2);
      _net := _item_total - _fee;

      INSERT INTO public.seller_earnings (
        order_id, order_item_id, seller_id, gross_amount, platform_fee, net_amount, status
      )
      VALUES (
        _order_id, _item.item_id, _product_seller, _item_total, _fee, _net, 'pending'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- Grant execution ONLY to service_role (and superusers/admin via security definer)
GRANT EXECUTE ON FUNCTION public.record_order_seller_earnings(UUID) TO service_role;
