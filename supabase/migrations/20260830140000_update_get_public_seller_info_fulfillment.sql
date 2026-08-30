-- Migration: Update get_public_seller_info to include fulfillment_model and pickup location fields

DROP FUNCTION IF EXISTS public.get_public_seller_info(uuid);

CREATE OR REPLACE FUNCTION public.get_public_seller_info(seller_uuid uuid)
 RETURNS TABLE(
   business_name text,
   business_address text,
   address text,
   phone text,
   fulfillment_model text,
   pickup_address text,
   pickup_landmark text,
   pickup_latitude numeric,
   pickup_longitude numeric,
   pickup_phone text,
   pickup_google_maps_url text
 )
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
          AND (o.assigned_rider_id = auth.uid() OR o.status IN ('confirmed', 'processing', 'shipped', 'delivered'))
      )
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT 
    s.business_name, 
    s.business_address, 
    s.address, 
    s.phone,
    s.fulfillment_model,
    s.pickup_address,
    s.pickup_landmark,
    s.pickup_latitude,
    s.pickup_longitude,
    s.pickup_phone,
    s.pickup_google_maps_url
  FROM public.seller_profiles s
  WHERE s.user_id = seller_uuid;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_public_seller_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_seller_info(uuid) TO authenticated, service_role;
