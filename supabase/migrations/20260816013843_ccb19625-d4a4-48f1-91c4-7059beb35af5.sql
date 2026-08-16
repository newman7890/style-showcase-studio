-- 1. Rider access codes: remove public read
DROP POLICY IF EXISTS "Anyone can verify access codes" ON public.rider_access_codes;
DROP POLICY IF EXISTS "Anyone can read access codes" ON public.rider_access_codes;
DROP POLICY IF EXISTS "Public can view access codes" ON public.rider_access_codes;
DROP POLICY IF EXISTS "Anyone can update access code when used" ON public.rider_access_codes;
REVOKE SELECT, UPDATE ON public.rider_access_codes FROM anon;
GRANT SELECT ON public.rider_access_codes TO authenticated;
GRANT ALL ON public.rider_access_codes TO service_role;

CREATE OR REPLACE FUNCTION public.verify_rider_access_code(_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rider_access_codes
    WHERE upper(code) = upper(trim(_code))
      AND COALESCE(is_used, false) = false
  );
$$;

CREATE OR REPLACE FUNCTION public.consume_rider_access_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _rows int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.rider_access_codes
     SET is_used = true, used_by = _uid, used_at = now()
   WHERE upper(code) = upper(trim(_code))
     AND COALESCE(is_used, false) = false;

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_rider_access_code(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rider_access_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_rider_access_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rider_access_code(text) TO authenticated;

-- 2. Marketing banners: remove blanket public UPDATE
DROP POLICY IF EXISTS "Anyone can update click_count on marketing banners" ON public.marketing_banners;

CREATE OR REPLACE FUNCTION public.increment_banner_click(_banner_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketing_banners
     SET click_count = COALESCE(click_count, 0) + 1
   WHERE id = _banner_id;
$$;

REVOKE ALL ON FUNCTION public.increment_banner_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_banner_click(uuid) TO anon, authenticated;