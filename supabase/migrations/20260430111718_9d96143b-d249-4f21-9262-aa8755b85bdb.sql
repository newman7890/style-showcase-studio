-- 1) Lock down discount_codes
DROP POLICY IF EXISTS "Anyone can read active discount codes for validation" ON public.discount_codes;

-- Safe validation function (returns minimal fields), callable by anyone
CREATE OR REPLACE FUNCTION public.validate_discount_code(_code text, _order_amount numeric)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  is_valid boolean,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.discount_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.discount_codes
  WHERE upper(trim(code)) = upper(trim(_code))
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, _code, NULL::text, NULL::numeric, NULL::numeric, false, 'Invalid code'::text;
    RETURN;
  END IF;

  IF v_row.valid_from IS NOT NULL AND v_row.valid_from > now() THEN
    RETURN QUERY SELECT v_row.id, v_row.code, v_row.discount_type, v_row.discount_value, v_row.min_order_amount, false, 'Code not yet active'::text;
    RETURN;
  END IF;

  IF v_row.valid_until IS NOT NULL AND v_row.valid_until < now() THEN
    RETURN QUERY SELECT v_row.id, v_row.code, v_row.discount_type, v_row.discount_value, v_row.min_order_amount, false, 'Code expired'::text;
    RETURN;
  END IF;

  IF v_row.max_uses IS NOT NULL AND COALESCE(v_row.current_uses, 0) >= v_row.max_uses THEN
    RETURN QUERY SELECT v_row.id, v_row.code, v_row.discount_type, v_row.discount_value, v_row.min_order_amount, false, 'Code usage limit reached'::text;
    RETURN;
  END IF;

  IF v_row.min_order_amount IS NOT NULL AND _order_amount < v_row.min_order_amount THEN
    RETURN QUERY SELECT v_row.id, v_row.code, v_row.discount_type, v_row.discount_value, v_row.min_order_amount, false, 'Order amount too low'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.code, v_row.discount_type, v_row.discount_value, v_row.min_order_amount, true, 'Valid'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_discount_code(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, numeric) TO anon, authenticated;

-- 2) Stop Realtime broadcasting of sensitive tables to all subscribers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.orders';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications';
  END IF;
END$$;

-- 3) Prevent privilege escalation on user_roles
-- Restrictive policies deny any write unless the actor is already an admin.
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role inserts" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role updates" ON public.user_roles;
DROP POLICY IF EXISTS "Block non-admin role deletes" ON public.user_roles;

CREATE POLICY "Block non-admin role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role updates"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Block non-admin role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Permissive policies allowing admins to manage roles (paired with restrictive above)
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO public
USING (public.has_role(auth.uid(), 'admin'::app_role));