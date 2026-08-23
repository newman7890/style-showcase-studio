-- Enforce rider account suspension in all rider database RPCs and policies

-- 1. Helper function to check if a rider is suspended
CREATE OR REPLACE FUNCTION public.is_rider_suspended(_rider_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins are never suspended
  IF public.has_role(_rider_id, 'admin') THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.rider_profiles
    WHERE user_id = _rider_id AND status = 'suspended'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_rider_suspended(UUID) TO authenticated;

-- 2. Update claim_order_by_rider to block suspended riders
CREATE OR REPLACE FUNCTION public.claim_order_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _current_assigned UUID;
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
  SELECT assigned_rider_id INTO _current_assigned
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
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

-- 3. Update mark_order_shipped_by_rider to block suspended riders
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

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
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

-- 4. Update mark_order_delivered_by_rider to block suspended riders
CREATE OR REPLACE FUNCTION public.mark_order_delivered_by_rider(_order_id UUID)
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

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  UPDATE public.orders
  SET status = 'delivered',
      payment_status = 'paid',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      updated_at = NOW()
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or update failed';
  END IF;

  RETURN TRUE;
END;
$$;

-- 5. Update orders RLS policy to hide available orders from suspended riders
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;
CREATE POLICY "Riders can view unassigned and assigned orders"
  ON public.orders FOR SELECT
  USING (
    NOT public.is_rider_suspended(auth.uid()) 
    AND (
      assigned_rider_id IS NULL 
      OR assigned_rider_id = auth.uid() 
      OR public.has_role(auth.uid(), 'admin')
    )
  );
