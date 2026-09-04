-- ==============================================================================
-- Migration: Secure Rider System & Delivery Authorization (Phase 2 Security Hardening)
-- ==============================================================================

-- 1. Add attempt tracking columns for Pickup and Delivery OTPs
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_otp_failed_attempts INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_otp_failed_attempts INT DEFAULT 0;

-- 2. Upgrade Pickup OTP generation to 6 digits
CREATE OR REPLACE FUNCTION public.generate_order_pickup_otp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pickup_otp IS NULL THEN
    -- Generate random 6-digit numeric PIN (100000 - 999999)
    NEW.pickup_otp := lpad(floor(100000 + random() * 900000)::int::text, 6, '0');
    NEW.pickup_otp_created_at := NOW();
    NEW.pickup_otp_failed_attempts := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_order_pickup_otp ON public.orders;
CREATE TRIGGER trg_generate_order_pickup_otp
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_pickup_otp();

-- 3. Hardened claim_order_by_rider RPC (ELIMINATES ROLE ESCALATION)
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

  -- CRITICAL SECURITY CHECK: Require approved rider role
  IF NOT public.has_role(_rider_id, 'rider'::app_role) THEN
    RAISE EXCEPTION 'Access denied: You must be an approved rider to claim orders.';
  END IF;

  -- Require active, non-suspended status
  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator. You cannot claim orders.';
  END IF;

  -- Lock order row for update
  SELECT assigned_rider_id, payment_status, status INTO _current_assigned, _payment_status, _status
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Ensure order is paid or confirmed
  IF COALESCE(_payment_status, '') != 'paid' AND _status NOT IN ('confirmed', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'This order has not been paid for by the customer and cannot be claimed.';
  END IF;

  IF _current_assigned IS NOT NULL AND _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'This order has already been claimed by another rider.';
  END IF;

  -- Assign order to this authenticated rider
  UPDATE public.orders
  SET assigned_rider_id = _rider_id,
      status = 'processing',
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_order_by_rider(UUID) TO authenticated;

-- Also update claim_delivery helper with same security checks
CREATE OR REPLACE FUNCTION public.claim_delivery(_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.claim_order_by_rider(_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_delivery(uuid) TO authenticated;

-- 4. Hardened confirm_pickup_otp RPC with assigned rider check and failed-attempt lockout
CREATE OR REPLACE FUNCTION public.confirm_pickup_otp(_order_id UUID, _otp TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _stored_otp TEXT;
  _current_status TEXT;
  _current_assigned UUID;
  _failed_attempts INT;
  _cust_delivery_otp TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Security: Require rider role
  IF NOT public.has_role(_rider_id, 'rider'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only verified riders can confirm package pickups.';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your rider account is suspended. You cannot perform pickups.';
  END IF;

  -- Lock order row
  SELECT status, pickup_otp, assigned_rider_id, COALESCE(pickup_otp_failed_attempts, 0)
  INTO _current_status, _stored_otp, _current_assigned, _failed_attempts
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Check status
  IF _current_status NOT IN ('pending', 'confirmed', 'processing') THEN
    IF _current_status = 'shipped' THEN
      RAISE EXCEPTION 'This order has already been picked up and is currently in transit.';
    ELSIF _current_status = 'delivered' THEN
      RAISE EXCEPTION 'This order has already been delivered.';
    ELSE
      RAISE EXCEPTION 'Invalid order status for pickup: %', _current_status;
    END IF;
  END IF;

  -- Security: Must be assigned rider (or claiming during pickup)
  IF _current_assigned IS NOT NULL AND _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'Access denied: This order is assigned to another rider.';
  END IF;

  -- Check lockout
  IF _failed_attempts >= 5 THEN
    RAISE EXCEPTION 'This order pickup has been locked due to too many failed PIN attempts. Please contact Support or the Seller.';
  END IF;

  -- Check OTP match
  IF trim(_otp) != trim(COALESCE(_stored_otp, '')) THEN
    UPDATE public.orders
    SET pickup_otp_failed_attempts = COALESCE(pickup_otp_failed_attempts, 0) + 1
    WHERE id = _order_id;

    RAISE EXCEPTION 'Invalid Handover PIN (%/5 attempts used). Please ask the seller for the correct code.', _failed_attempts + 1;
  END IF;

  -- Generate 6-digit customer delivery OTP
  _cust_delivery_otp := lpad(floor(100000 + random() * 900000)::int::text, 6, '0');

  -- OTP Verified -> Mark In Transit
  UPDATE public.orders
  SET status = 'shipped',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      pickup_confirmed_at = NOW(),
      pickup_rider_id = _rider_id,
      pickup_otp_failed_attempts = 0,
      delivery_otp = COALESCE(delivery_otp, _cust_delivery_otp),
      delivery_otp_created_at = NOW(),
      delivery_otp_failed_attempts = 0,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pickup_otp(UUID, TEXT) TO authenticated;

-- 5. Hardened confirm_delivery_otp RPC with strict assigned rider check and lockout
CREATE OR REPLACE FUNCTION public.confirm_delivery_otp(_order_id UUID, _otp TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _stored_otp TEXT;
  _otp_created TIMESTAMPTZ;
  _order_status TEXT;
  _assigned_rider UUID;
  _failed_attempts INT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Security: Require rider role
  IF NOT public.has_role(_rider_id, 'rider'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only verified riders can confirm deliveries.';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  -- Lock the order row
  SELECT status, delivery_otp, delivery_otp_created_at, assigned_rider_id, COALESCE(delivery_otp_failed_attempts, 0)
  INTO _order_status, _stored_otp, _otp_created, _assigned_rider, _failed_attempts
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Security: Must be the assigned rider
  IF _assigned_rider IS NULL OR _assigned_rider != _rider_id THEN
    RAISE EXCEPTION 'Access denied: You are not the assigned rider for this delivery.';
  END IF;

  -- Only shipped orders can be confirmed
  IF _order_status != 'shipped' THEN
    RAISE EXCEPTION 'Order must be in "shipped" status to confirm delivery. Current status: %', _order_status;
  END IF;

  -- Check lockout
  IF _failed_attempts >= 5 THEN
    RAISE EXCEPTION 'Delivery verification is locked due to 5 incorrect OTP attempts. Please contact Administrator for assistance.';
  END IF;

  IF _stored_otp IS NULL THEN
    RAISE EXCEPTION 'No delivery OTP found for this order.';
  END IF;

  -- Verify OTP
  IF upper(trim(_otp)) != upper(trim(_stored_otp)) THEN
    UPDATE public.orders
    SET delivery_otp_failed_attempts = COALESCE(delivery_otp_failed_attempts, 0) + 1
    WHERE id = _order_id;

    RAISE EXCEPTION 'Invalid Delivery OTP (%/5 attempts used). Please ask the customer for the correct code.', _failed_attempts + 1;
  END IF;

  -- OTP verified — mark as delivered
  UPDATE public.orders
  SET status = 'delivered',
      payment_status = 'paid',
      delivery_otp = NULL,
      delivery_otp_created_at = NULL,
      delivery_otp_failed_attempts = 0,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_otp(UUID, TEXT) TO authenticated;

-- 6. Hardened mark_order_shipped_by_rider RPC
CREATE OR REPLACE FUNCTION public.mark_order_shipped_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _current_assigned UUID;
  _otp TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Require rider role
  IF NOT public.has_role(_rider_id, 'rider'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only verified riders can mark orders as shipped.';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  -- Verify assignment
  SELECT assigned_rider_id INTO _current_assigned
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _current_assigned IS NOT NULL AND _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'Access denied: Order is assigned to another rider.';
  END IF;

  -- Generate 6-digit OTP
  _otp := lpad(floor(100000 + random() * 900000)::int::text, 6, '0');

  UPDATE public.orders
  SET status = 'shipped',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      delivery_otp = COALESCE(delivery_otp, _otp),
      delivery_otp_created_at = NOW(),
      delivery_otp_failed_attempts = 0,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_shipped_by_rider(UUID) TO authenticated;

-- 7. Hardened mark_order_delivered_by_rider RPC
CREATE OR REPLACE FUNCTION public.mark_order_delivered_by_rider(_order_id UUID)
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
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.has_role(_rider_id, 'rider'::app_role) THEN
    RAISE EXCEPTION 'Access denied: Only verified riders can mark orders as delivered.';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  SELECT assigned_rider_id INTO _current_assigned
  FROM public.orders
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF _current_assigned IS NULL OR _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'Access denied: You are not the assigned rider for this order.';
  END IF;

  UPDATE public.orders
  SET status = 'delivered',
      payment_status = 'paid',
      delivery_otp = NULL,
      delivery_otp_created_at = NULL,
      delivery_otp_failed_attempts = 0,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_order_delivered_by_rider(UUID) TO authenticated;
