-- Add tracking_code column to orders table
ALTER TABLE public.orders
ADD COLUMN tracking_code text UNIQUE;

-- Create function to generate tracking code
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    -- Generate a tracking code like: TRK-XXXXXX-XXXX
    new_code := 'TRK-' || 
                upper(substr(md5(random()::text), 1, 6)) || '-' || 
                upper(substr(md5(random()::text), 1, 4));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE tracking_code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$;

-- Create trigger to auto-generate tracking code on order creation
CREATE OR REPLACE FUNCTION public.set_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := generate_tracking_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_tracking_code
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_tracking_code();

-- Allow public to view orders by tracking code (for tracking page)
CREATE POLICY "Anyone can view orders by tracking code"
ON public.orders
FOR SELECT
USING (tracking_code IS NOT NULL);