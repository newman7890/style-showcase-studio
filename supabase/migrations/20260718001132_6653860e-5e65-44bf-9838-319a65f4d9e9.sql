
CREATE OR REPLACE FUNCTION public.restrict_rider_order_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for rider actors who are not also admins
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF NOT public.has_role(auth.uid(), 'rider') THEN RETURN NEW; END IF;

  -- Riders may only modify status (and updated_at). Force all other columns
  -- back to their original values.
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_rider_order_updates ON public.orders;
CREATE TRIGGER trg_restrict_rider_order_updates
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.restrict_rider_order_updates();
