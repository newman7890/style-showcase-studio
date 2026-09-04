-- ==============================================================================
-- Migration: Seller Pickup Handover OTP (Proof of Handover / Chain of Custody)
-- ==============================================================================
-- Adds pickup_otp columns to orders table, automatically generates a 4-digit
-- Handover PIN for sellers, creates confirm_pickup_otp RPC for riders, and
-- provides get_pickup_otp_for_seller RPC so sellers can safely view their PIN.
-- ==============================================================================

-- 1. Add Pickup OTP columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_otp TEXT,
  ADD COLUMN IF NOT EXISTS pickup_otp_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_rider_id UUID REFERENCES public.profiles(id);

-- 2. Trigger function to auto-generate a 4-digit pickup_otp on order creation
CREATE OR REPLACE FUNCTION public.generate_order_pickup_otp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pickup_otp IS NULL THEN
    -- Generate random 4-digit numeric code (1000 - 9999)
    NEW.pickup_otp := lpad(floor(1000 + random() * 9000)::int::text, 4, '0');
    NEW.pickup_otp_created_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_order_pickup_otp ON public.orders;
CREATE TRIGGER trg_generate_order_pickup_otp
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_pickup_otp();

-- 3. Backfill pickup_otp for any active orders that don't have one yet
UPDATE public.orders
SET pickup_otp = lpad(floor(1000 + random() * 9000)::int::text, 4, '0'),
    pickup_otp_created_at = NOW()
WHERE pickup_otp IS NULL
  AND status IN ('pending', 'confirmed', 'processing');

-- 4. RPC for Rider to verify Seller Pickup OTP and mark order as Shipped (In Transit)
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
  _cust_delivery_otp TEXT;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Your rider account is suspended. You cannot perform pickups.';
  END IF;

  -- Lock order row
  SELECT status, pickup_otp, assigned_rider_id
  INTO _current_status, _stored_otp, _current_assigned
  FROM public.orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Check status is valid for pickup
  IF _current_status NOT IN ('pending', 'confirmed', 'processing') THEN
    IF _current_status = 'shipped' THEN
      RAISE EXCEPTION 'This order has already been picked up and is currently in transit.';
    ELSIF _current_status = 'delivered' THEN
      RAISE EXCEPTION 'This order has already been delivered.';
    ELSIF _current_status = 'cancelled' THEN
      RAISE EXCEPTION 'This order was cancelled and cannot be picked up.';
    ELSE
      RAISE EXCEPTION 'Invalid order status for pickup: %', _current_status;
    END IF;
  END IF;

  -- Check assigned rider
  IF _current_assigned IS NOT NULL AND _current_assigned != _rider_id THEN
    RAISE EXCEPTION 'This order is assigned to another rider.';
  END IF;

  -- Validate OTP exists
  IF _stored_otp IS NULL THEN
    -- Fallback: auto-create if missing
    _stored_otp := lpad(floor(1000 + random() * 9000)::int::text, 4, '0');
    UPDATE public.orders SET pickup_otp = _stored_otp WHERE id = _order_id;
  END IF;

  -- Validate OTP match (trimmed)
  IF trim(_otp) != trim(_stored_otp) THEN
    RAISE EXCEPTION 'Invalid Pickup PIN. Please ask the seller for the 4-digit handover code on their dashboard.';
  END IF;

  -- Generate 6-digit customer delivery OTP for the next step (Proof of Delivery)
  _cust_delivery_otp := lpad(floor(random() * 1000000)::int::text, 6, '0');

  -- Update order to 'shipped' (In Transit)
  UPDATE public.orders
  SET status = 'shipped',
      assigned_rider_id = COALESCE(assigned_rider_id, _rider_id),
      pickup_confirmed_at = NOW(),
      pickup_rider_id = _rider_id,
      delivery_otp = COALESCE(delivery_otp, _cust_delivery_otp),
      delivery_otp_created_at = NOW(),
      updated_at = NOW()
  WHERE id = _order_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pickup_otp(UUID, TEXT) TO authenticated;

-- 5. RPC for Sellers to safely retrieve the Pickup OTP for an order containing their items
CREATE OR REPLACE FUNCTION public.get_pickup_otp_for_seller(_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _is_seller BOOLEAN := FALSE;
  _is_admin BOOLEAN := FALSE;
  _otp TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check if admin
  _is_admin := public.has_role(_user_id, 'admin');

  -- Check if user is a seller who has items in this order
  IF NOT _is_admin THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = _order_id 
        AND (oi.seller_id = _user_id OR p.seller_id = _user_id)
    ) INTO _is_seller;
  END IF;

  IF NOT _is_admin AND NOT _is_seller THEN
    RAISE EXCEPTION 'Unauthorized: You are not a seller for items in this order.';
  END IF;

  SELECT pickup_otp INTO _otp
  FROM public.orders
  WHERE id = _order_id;

  RETURN _otp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pickup_otp_for_seller(UUID) TO authenticated;
