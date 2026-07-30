DROP VIEW IF EXISTS public.public_seller_info;

CREATE OR REPLACE FUNCTION public.get_public_seller_info(seller_uuid uuid)
 RETURNS TABLE(business_name text, business_address text, address text, phone text)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT s.business_name, s.business_address, s.address, s.phone
  FROM public.seller_profiles s
  WHERE s.user_id = seller_uuid;
END;
$function$;