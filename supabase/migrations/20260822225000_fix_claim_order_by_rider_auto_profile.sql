-- Upgrade claim_order_by_rider to auto-ensure rider profile and role, preventing claim failure
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

GRANT EXECUTE ON FUNCTION public.claim_order_by_rider(UUID) TO authenticated;
