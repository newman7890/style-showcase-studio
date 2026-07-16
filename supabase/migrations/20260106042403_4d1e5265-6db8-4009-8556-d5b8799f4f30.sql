-- Fix search_path for generate_tracking_code function
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := 'TRK-' || 
                upper(substr(md5(random()::text), 1, 6)) || '-' || 
                upper(substr(md5(random()::text), 1, 4));
    
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE tracking_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;