
-- Fix 1: enforce_order_pricing must not null out discount_code when items are not yet inserted.
-- Preserve discount_code as provided; the AFTER trigger recompute_order_total will validate and
-- apply the discount once order_items exist.
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fee NUMERIC := 0;
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

  -- Normalize discount code (trim/empty -> NULL), but do NOT validate here.
  -- At INSERT time order_items don't exist yet, so we cannot know the items
  -- total. The AFTER trigger on order_items (recompute_order_total) validates
  -- the code against the real items total and sets discount_amount + total.
  IF NEW.discount_code IS NOT NULL AND length(trim(NEW.discount_code)) = 0 THEN
    NEW.discount_code := NULL;
  END IF;

  -- Start with 0 discount; recompute_order_total will overwrite once items exist.
  NEW.discount_amount := 0;

  RETURN NEW;
END;
$function$;

-- Fix 2: re-grant EXECUTE on has_role to anon so RLS policies that reference it
-- do not error out anonymous queries with "permission denied for function has_role".
-- has_role is SECURITY DEFINER and only reads user_roles, so exposing EXECUTE is safe.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
