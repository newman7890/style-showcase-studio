-- Normalize order status strings to lowercase and repair delivered orders assigned_rider_id
UPDATE public.orders
SET status = 'delivered'
WHERE lower(status) = 'delivered';

UPDATE public.orders
SET status = 'shipped'
WHERE lower(status) = 'shipped';

UPDATE public.orders
SET status = 'processing'
WHERE lower(status) = 'processing';

-- Retroactively set assigned_rider_id for delivered orders if null
DO $$
DECLARE
  _rider_id UUID;
BEGIN
  -- Get user id for newm5811@gmail.com
  SELECT id INTO _rider_id FROM auth.users WHERE lower(email) = 'newm5811@gmail.com';

  IF _rider_id IS NOT NULL THEN
    UPDATE public.orders
    SET assigned_rider_id = _rider_id
    WHERE status = 'delivered' AND (assigned_rider_id IS NULL OR assigned_rider_id = _rider_id);
  END IF;
END $$;
