-- Create atomic RPC for riders to mark order as shipped / in-transit
CREATE OR REPLACE FUNCTION public.mark_order_shipped_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.orders
  SET status = 'shipped',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      updated_at = NOW()
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or update failed';
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_shipped_by_rider(UUID) TO authenticated;
