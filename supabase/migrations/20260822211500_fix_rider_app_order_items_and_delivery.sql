-- 1. Grant RLS permission for Riders to SELECT order_items
DROP POLICY IF EXISTS "Riders can view order items" ON public.order_items;

CREATE POLICY "Riders can view order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rider')
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.assigned_rider_id = auth.uid() OR orders.assigned_rider_id IS NULL)
    )
  );

-- 2. Create atomic RPC for riders to mark order as delivered and set payment_status to paid
CREATE OR REPLACE FUNCTION public.mark_order_delivered_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.orders
  SET status = 'delivered',
      payment_status = 'paid',
      updated_at = NOW()
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or update failed';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_delivered_by_rider(UUID) TO authenticated;
