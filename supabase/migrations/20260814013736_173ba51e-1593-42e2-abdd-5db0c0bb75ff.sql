DROP POLICY IF EXISTS "Users can apply as seller" ON public.seller_profiles;
CREATE POLICY "Users can apply as seller"
ON public.seller_profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending'::seller_status);

CREATE OR REPLACE FUNCTION public.get_public_seller_info(seller_uuid uuid)
 RETURNS TABLE(business_name text, business_address text, address text, phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    auth.uid() = seller_uuid
    OR public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'rider')
      AND EXISTS (
        SELECT 1
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.seller_id = seller_uuid
          AND o.assigned_rider_id = auth.uid()
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT s.business_name, s.business_address, s.address, s.phone
  FROM public.seller_profiles s
  WHERE s.user_id = seller_uuid;
END;
$function$;