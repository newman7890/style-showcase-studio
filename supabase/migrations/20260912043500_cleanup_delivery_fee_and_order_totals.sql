-- ==============================================================================
-- Migration: 20260912043500_cleanup_delivery_fee_and_order_totals.sql
-- Description:
--   1. Clean up and solidify resolve_delivery_fee function with case-insensitive trimming and exact matching.
--   2. Fix recompute_order_total to use shipping_town (not street address) and respect purchased unit price (oi.price).
-- ==============================================================================

-- 1. Upgrade resolve_delivery_fee with complete fallback chain
CREATE OR REPLACE FUNCTION public.resolve_delivery_fee(
  _region TEXT, 
  _city TEXT, 
  _town TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
  v_reg TEXT;
  v_cit TEXT;
  v_twn TEXT;
BEGIN
  v_reg := lower(trim(COALESCE(_region, '')));
  v_cit := lower(trim(COALESCE(_city, '')));
  v_twn := lower(trim(COALESCE(_town, '')));

  -- 1. Exact match on town + city + region
  IF length(v_twn) > 0 AND length(v_cit) > 0 AND length(v_reg) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = v_reg
      AND city IS NOT NULL AND lower(trim(city)) = v_cit
      AND town IS NOT NULL AND lower(trim(town)) = v_twn
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 2. Exact match on town + region (any or no city specified on row)
  IF length(v_twn) > 0 AND length(v_reg) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = v_reg
      AND town IS NOT NULL AND lower(trim(town)) = v_twn
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 3. Exact match on city + region (no town specified on row)
  IF length(v_cit) > 0 AND length(v_reg) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = v_reg
      AND city IS NOT NULL AND lower(trim(city)) = v_cit
      AND (town IS NULL OR length(trim(town)) = 0)
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 4. Region-only match (no city or town specified on row)
  IF length(v_reg) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = v_reg
      AND (city IS NULL OR length(trim(city)) = 0)
      AND (town IS NULL OR length(trim(town)) = 0)
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 5. Any active region row fallback
  IF length(v_reg) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = v_reg
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 6. Default platform delivery fee fallback
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_default = true AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_fee, 0);
END;
$$;

-- Grant execution to public / anon / authenticated for storefront calculations
GRANT EXECUTE ON FUNCTION public.resolve_delivery_fee(TEXT, TEXT, TEXT) TO authenticated, anon, service_role;

-- 2. Solidify recompute_order_total trigger function
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
  v_existing_delivery numeric;
  v_discount numeric;
  v_region text;
  v_city text;
  v_town text;
  v_code text;
  v_valid RECORD;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  -- Sum items using purchased item price (oi.price) or product price
  SELECT COALESCE(SUM(oi.quantity * COALESCE(oi.price, p.price)), 0)
    INTO v_items_total
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = v_order_id;

  SELECT shipping_region, shipping_city, shipping_town, discount_code, delivery_fee
    INTO v_region, v_city, v_town, v_code, v_existing_delivery
  FROM public.orders
  WHERE id = v_order_id;

  IF v_existing_delivery IS NOT NULL AND v_existing_delivery >= 0 THEN
    v_delivery := v_existing_delivery;
  ELSE
    v_delivery := COALESCE(public.resolve_delivery_fee(v_region, v_city, v_town), 0);
  END IF;

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
