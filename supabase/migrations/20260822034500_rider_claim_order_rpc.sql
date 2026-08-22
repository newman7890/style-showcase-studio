-- Create atomic RPC function for riders to claim unassigned orders
CREATE OR REPLACE FUNCTION public.claim_order_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _current_assigned UUID;
  _current_status TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim orders';
  END IF;

  -- Ensure user has rider role or profile
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _rider_id AND role = 'rider'::app_role
  ) AND NOT EXISTS (
    SELECT 1 FROM public.rider_profiles WHERE user_id = _rider_id
  ) THEN
    RAISE EXCEPTION 'Only registered riders can claim delivery orders';
  END IF;

  -- Lock order row for update to prevent race conditions between riders
  SELECT assigned_rider_id, status INTO _current_assigned, _current_status
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _current_assigned IS NOT NULL THEN
    RAISE EXCEPTION 'This order has already been claimed by another rider.';
  END IF;

  -- Assign order to this rider and update status
  UPDATE public.orders
  SET assigned_rider_id = _rider_id,
      status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_order_by_rider(UUID) TO authenticated;

-- Allow riders to view unassigned orders available for claiming
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;
CREATE POLICY "Riders can view unassigned and assigned orders"
  ON public.orders FOR SELECT
  USING (
    assigned_rider_id IS NULL 
    OR assigned_rider_id = auth.uid() 
    OR public.has_role(auth.uid(), 'admin')
  );
