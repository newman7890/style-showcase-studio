-- Ensure riders only view unassigned active orders or their own assigned/delivered orders
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;

CREATE POLICY "Riders can view unassigned and assigned orders"
  ON public.orders FOR SELECT
  USING (
    NOT public.is_rider_suspended(auth.uid()) 
    AND (
      (assigned_rider_id IS NULL AND status NOT IN ('delivered', 'cancelled', 'refunded'))
      OR assigned_rider_id = auth.uid() 
      OR public.has_role(auth.uid(), 'admin')
    )
  );
