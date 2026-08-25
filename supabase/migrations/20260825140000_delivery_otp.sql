-- OTP Proof of Delivery
-- Adds delivery OTP columns to orders, updates mark_order_shipped to generate OTP,
-- creates confirm_delivery_otp RPC for riders, and get_delivery_otp_for_customer RPC for customers.

-- 1. Add OTP columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_otp TEXT,
  ADD COLUMN IF NOT EXISTS delivery_otp_created_at TIMESTAMPTZ;

-- 2. Update mark_order_shipped_by_rider to auto-generate a 6-digit OTP
CREATE OR REPLACE FUNCTION public.mark_order_shipped_by_rider(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _otp TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  -- Generate a random 6-digit numeric OTP
  _otp := lpad(floor(random() * 1000000)::int::text, 6, '0');

  UPDATE public.orders
  SET status = 'shipped',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      delivery_otp = _otp,
      delivery_otp_created_at = NOW(),
      updated_at = NOW()
  WHERE id = _order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or update failed';
  END IF;

  RETURN TRUE;
END;
$$;

-- 3. Create confirm_delivery_otp RPC for riders to verify OTP and mark delivered
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
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your account has been suspended by an Administrator.';
  END IF;

  -- Lock the order row and fetch current state
  SELECT status, delivery_otp, delivery_otp_created_at
  INTO _order_status, _stored_otp, _otp_created
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Only shipped orders can be confirmed via OTP
  IF _order_status != 'shipped' THEN
    RAISE EXCEPTION 'Order must be in "shipped" status to confirm delivery. Current status: %', _order_status;
  END IF;

  -- Check OTP exists
  IF _stored_otp IS NULL THEN
    RAISE EXCEPTION 'No delivery OTP found for this order. Please mark the order as shipped first.';
  END IF;

  -- Verify OTP (case-insensitive, trimmed)
  IF upper(trim(_otp)) != upper(trim(_stored_otp)) THEN
    RAISE EXCEPTION 'Invalid OTP code. Please ask the customer for the correct code.';
  END IF;

  -- Check OTP expiry (24 hours)
  IF _otp_created IS NOT NULL AND _otp_created < NOW() - INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'OTP has expired. Please contact support for assistance.';
  END IF;

  -- OTP verified — mark as delivered
  UPDATE public.orders
  SET status = 'delivered',
      payment_status = 'paid',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      delivery_otp = NULL,
      delivery_otp_created_at = NULL,
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_delivery_otp(UUID, TEXT) TO authenticated;

-- 4. Create RPC for customers to retrieve their delivery OTP (own orders only)
CREATE OR REPLACE FUNCTION public.get_delivery_otp_for_customer(_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _otp TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT delivery_otp INTO _otp
  FROM public.orders
  WHERE id = _order_id
    AND user_id = _user_id
    AND status = 'shipped';

  -- Return NULL if not found (no error, just no OTP available)
  RETURN _otp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_delivery_otp_for_customer(UUID) TO authenticated;
