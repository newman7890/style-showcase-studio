
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

  -- Server-authoritative delivery fee based on region/city
  v_fee := public.resolve_delivery_fee(NEW.shipping_region, NEW.shipping_city);
  NEW.delivery_fee := COALESCE(v_fee, 0);

  -- Server-authoritative discount from discount_code
  IF NEW.discount_code IS NOT NULL AND length(trim(NEW.discount_code)) > 0 THEN
    -- Compute the pre-discount items total for this order (0 for new orders, will recompute after items insert)
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
      -- Never exceed the items total
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

DROP TRIGGER IF EXISTS trg_enforce_order_pricing ON public.orders;
CREATE TRIGGER trg_enforce_order_pricing
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_order_pricing();

-- Update the recompute trigger to also re-derive delivery fee + discount from server-authoritative sources
CREATE OR REPLACE FUNCTION public.recompute_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_items_total numeric;
  v_delivery numeric;
  v_discount numeric;
  v_region text;
  v_city text;
  v_code text;
  v_valid RECORD;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(oi.quantity * p.price), 0)
    INTO v_items_total
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = v_order_id;

  SELECT shipping_region, shipping_city, discount_code
    INTO v_region, v_city, v_code
  FROM public.orders
  WHERE id = v_order_id;

  v_delivery := COALESCE(public.resolve_delivery_fee(v_region, v_city), 0);

  v_discount := 0;
  IF v_code IS NOT NULL AND length(trim(v_code)) > 0 THEN
    SELECT * INTO v_valid FROM public.validate_discount_code(v_code, v_items_total) LIMIT 1;
    IF v_valid.is_valid THEN
      IF v_valid.discount_type = 'percentage' THEN
        v_discount := ROUND(v_items_total * (v_valid.discount_value / 100.0), 2);
      ELSIF v_valid.discount_type = 'fixed' THEN
        v_discount := v_valid.discount_value;
      END IF;
      IF v_discount > v_items_total THEN v_discount := v_items_total; END IF;
    END IF;
  END IF;

  UPDATE public.orders
  SET total_amount = GREATEST(v_items_total + COALESCE(v_delivery, 0) - COALESCE(v_discount, 0), 0),
      delivery_fee = v_delivery,
      discount_amount = v_discount,
      updated_at = now()
  WHERE id = v_order_id;

  RETURN NULL;
END;
$$;
