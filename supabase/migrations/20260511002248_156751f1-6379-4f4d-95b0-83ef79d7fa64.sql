-- Recompute orders.total_amount server-side from order_items × products.price
CREATE OR REPLACE FUNCTION public.recompute_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_items_total numeric;
  v_delivery numeric;
  v_discount numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(oi.quantity * p.price), 0)
    INTO v_items_total
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = v_order_id;

  SELECT COALESCE(delivery_fee, 0), COALESCE(discount_amount, 0)
    INTO v_delivery, v_discount
  FROM public.orders
  WHERE id = v_order_id;

  UPDATE public.orders
  SET total_amount = GREATEST(v_items_total + COALESCE(v_delivery, 0) - COALESCE(v_discount, 0), 0),
      updated_at = now()
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_order_total_ins ON public.order_items;
CREATE TRIGGER trg_recompute_order_total_ins
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.recompute_order_total();