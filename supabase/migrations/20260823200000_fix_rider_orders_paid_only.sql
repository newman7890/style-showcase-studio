-- Enforce that ONLY PAID / CONFIRMED orders are visible and claimable by delivery riders

-- 1. Update RLS policy on public.orders for riders
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;

CREATE POLICY "Riders can view unassigned and assigned orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    NOT public.is_rider_suspended(auth.uid()) 
    AND (
      (
        assigned_rider_id IS NULL 
        AND (payment_status = 'paid' OR status IN ('confirmed', 'processing', 'shipped'))
        AND status NOT IN ('pending', 'delivered', 'cancelled', 'refunded')
      )
      OR assigned_rider_id = auth.uid()
    )
  );

-- 2. Update get_available_deliveries RPC function
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
    AND (o.payment_status = 'paid' OR o.status IN ('confirmed', 'processing', 'shipped'))
    AND o.status NOT IN ('pending', 'delivered', 'cancelled', 'refunded')
  ORDER BY o.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_deliveries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_deliveries() TO authenticated, service_role;

-- 3. Update claim_order_by_rider RPC function to reject unpaid orders
CREATE OR REPLACE FUNCTION public.claim_order_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _current_assigned UUID;
  _payment_status TEXT;
  _status TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to claim orders';
  END IF;

  -- Block if rider account is suspended
  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator. You cannot claim orders.';
  END IF;

  -- Ensure rider profile exists
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = _rider_id) THEN
    INSERT INTO public.rider_profiles (user_id, full_name, status)
    VALUES (_rider_id, 'Rider', 'active')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Ensure rider role exists
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _rider_id AND role = 'rider'::app_role) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_rider_id, 'rider'::app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Lock order row for update
  SELECT assigned_rider_id, payment_status, status INTO _current_assigned, _payment_status, _status
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Ensure order is paid and active
  IF COALESCE(_payment_status, '') != 'paid' AND _status NOT IN ('confirmed', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'This order has not been paid for by the customer and cannot be claimed.';
  END IF;

  IF _current_assigned IS NOT NULL AND _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'This order has already been claimed by another rider.';
  END IF;

  -- Assign order to this rider
  UPDATE public.orders
  SET assigned_rider_id = _rider_id,
      status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_by_rider(UUID) TO authenticated;

-- 4. Update claim_delivery RPC function to reject unpaid orders
CREATE OR REPLACE FUNCTION public.claim_delivery(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  v_updated int;
  _payment_status text;
  _status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'rider') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF public.is_rider_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;

  SELECT payment_status, status INTO _payment_status, _status
  FROM public.orders WHERE id = _order_id;

  IF COALESCE(_payment_status, '') != 'paid' AND _status NOT IN ('confirmed', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'Order is unpaid';
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
