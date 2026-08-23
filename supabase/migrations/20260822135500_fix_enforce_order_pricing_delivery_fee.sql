-- Fix enforce_order_pricing trigger to preserve client-provided delivery_fee or pass address to resolve_delivery_fee
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_valid RECORD;
  v_items_total NUMERIC := 0;
BEGIN
  -- Only enforce while the order is still pending (not yet paid/processed).
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'pending' THEN
    NEW.delivery_fee := OLD.delivery_fee;
    NEW.discount_amount := OLD.discount_amount;
    NEW.discount_code := OLD.discount_code;
    RETURN NEW;
  END IF;

  -- Preserve client-provided delivery_fee if present, otherwise resolve with full town/address
  IF NEW.delivery_fee IS NOT NULL AND NEW.delivery_fee >= 0 THEN
    -- Keep NEW.delivery_fee as provided by client checkout
  ELSE
    v_fee := public.resolve_delivery_fee(NEW.shipping_region, NEW.shipping_city, NEW.shipping_address);
    NEW.delivery_fee := COALESCE(v_fee, 0);
  END IF;

  -- Server-authoritative discount from discount_code
  IF NEW.discount_code IS NOT NULL AND length(trim(NEW.discount_code)) > 0 THEN
    SELECT COALESCE(SUM(oi.quantity * p.price), 0)
      INTO v_items_total
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id;

    SELECT * INTO v_valid
    FROM public.validate_discount_code(NEW.discount_code, GREATEST(v_items_total, 0))
    LIMIT 1;

    IF v_valid.is_valid THEN
      IF v_valid.discount_type = 'percentage' THEN
        v_discount := ROUND(GREATEST(v_items_total, 0) * (v_valid.discount_value / 100.0), 2);
      ELSIF v_valid.discount_type = 'fixed' THEN
        v_discount := v_valid.discount_value;
      ELSE
        v_discount := 0;
      END IF;
      IF v_discount > v_items_total THEN
        v_discount := v_items_total;
      END IF;
    ELSE
      v_discount := 0;
      NEW.discount_code := NULL;
    END IF;
  ELSE
    NEW.discount_code := NULL;
    v_discount := 0;
  END IF;

  NEW.discount_amount := COALESCE(v_discount, 0);
  RETURN NEW;
END;
$$;
