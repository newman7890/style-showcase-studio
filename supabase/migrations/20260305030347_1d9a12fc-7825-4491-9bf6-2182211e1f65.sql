
-- Allow riders to view all orders (for delivery)
CREATE POLICY "Riders can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'rider'::app_role));

-- Allow riders to update order status (e.g. mark as delivered)
CREATE POLICY "Riders can update order status"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'rider'::app_role));

-- Allow riders to view order items
CREATE POLICY "Riders can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'rider'::app_role));
