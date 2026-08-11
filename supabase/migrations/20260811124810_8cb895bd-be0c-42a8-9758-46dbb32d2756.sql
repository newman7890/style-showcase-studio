ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_rider_id uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider ON public.orders(assigned_rider_id);

DROP POLICY IF EXISTS "Riders can view all orders" ON public.orders;
CREATE POLICY "Riders can view assigned orders"
ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'rider') AND assigned_rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can update order status" ON public.orders;
CREATE POLICY "Riders can update assigned order status"
ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'rider') AND assigned_rider_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'rider') AND assigned_rider_id = auth.uid());

DROP POLICY IF EXISTS "Riders can view all order items" ON public.order_items;
CREATE POLICY "Riders can view assigned order items"
ON public.order_items FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'rider')
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.assigned_rider_id = auth.uid()
  )
);

-- Riders may only change status/updated_at (existing trigger), but must not reassign orders
CREATE OR REPLACE FUNCTION public.restrict_rider_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF NOT public.has_role(auth.uid(), 'rider') THEN RETURN NEW; END IF;

  NEW.user_id            := OLD.user_id;
  NEW.total_amount       := OLD.total_amount;
  NEW.currency           := OLD.currency;
  NEW.shipping_name      := OLD.shipping_name;
  NEW.shipping_email     := OLD.shipping_email;
  NEW.shipping_phone     := OLD.shipping_phone;
  NEW.shipping_address   := OLD.shipping_address;
  NEW.shipping_city      := OLD.shipping_city;
  NEW.shipping_region    := OLD.shipping_region;
  NEW.payment_method     := OLD.payment_method;
  NEW.tracking_code      := OLD.tracking_code;
  NEW.delivery_fee       := OLD.delivery_fee;
  NEW.discount_amount    := OLD.discount_amount;
  NEW.discount_code      := OLD.discount_code;
  NEW.created_at         := OLD.created_at;
  NEW.assigned_rider_id  := OLD.assigned_rider_id;

  RETURN NEW;
END;
$function$;

-- Masked list of unclaimed deliveries for riders
CREATE OR REPLACE FUNCTION public.get_available_deliveries()
RETURNS TABLE(id uuid, tracking_code text, status text, shipping_city text, shipping_region text, total_amount numeric, currency text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(), 'rider') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT o.id, o.tracking_code, o.status, o.shipping_city, o.shipping_region,
         o.total_amount, o.currency, o.created_at
  FROM public.orders o
  WHERE o.assigned_rider_id IS NULL
    AND o.status NOT IN ('delivered','cancelled','refunded')
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_deliveries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_deliveries() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_delivery(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_updated int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'rider') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.orders
  SET assigned_rider_id = auth.uid(), updated_at = now()
  WHERE id = _order_id AND assigned_rider_id IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_delivery(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_delivery(uuid) TO authenticated, service_role;