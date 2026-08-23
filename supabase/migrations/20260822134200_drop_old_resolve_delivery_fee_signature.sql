-- Drop old 2-argument signature to eliminate Postgres function overloading ambiguity
DROP FUNCTION IF EXISTS public.resolve_delivery_fee(text, text);

-- Re-create single 3-argument signature with default NULL for town
CREATE OR REPLACE FUNCTION public.resolve_delivery_fee(_region TEXT, _city TEXT, _town TEXT DEFAULT NULL)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
BEGIN
  -- 1. Exact town + city + region match
  IF _town IS NOT NULL AND length(trim(_town)) > 0 AND _city IS NOT NULL AND length(trim(_city)) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = lower(trim(_region))
      AND city IS NOT NULL AND lower(trim(city)) = lower(trim(_city))
      AND town IS NOT NULL AND lower(trim(town)) = lower(trim(_town))
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 2. Exact town + region match
  IF _town IS NOT NULL AND length(trim(_town)) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = lower(trim(_region))
      AND town IS NOT NULL AND lower(trim(town)) = lower(trim(_town))
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 3. Exact city + region match (no town specified on fee row)
  IF _city IS NOT NULL AND length(trim(_city)) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = lower(trim(_region))
      AND city IS NOT NULL AND lower(trim(city)) = lower(trim(_city))
      AND (town IS NULL OR length(trim(town)) = 0)
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 4. Region-only match (no city or town on fee row)
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_active = true
    AND lower(trim(region)) = lower(trim(_region))
    AND (city IS NULL OR length(trim(city)) = 0)
    AND (town IS NULL OR length(trim(town)) = 0)
  LIMIT 1;
  IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;

  -- 5. Default fallback
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_default = true AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_fee, 0);
END;
$$;
