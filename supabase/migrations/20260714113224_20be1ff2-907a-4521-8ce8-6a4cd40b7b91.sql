-- 1. Products: auto-approve on insert
ALTER TABLE public.products ALTER COLUMN status SET DEFAULT 'approved';

-- Relax the protection trigger: sellers can edit products without reverting to pending
CREATE OR REPLACE FUNCTION public.protect_product_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.status := OLD.status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.seller_id := OLD.seller_id;
  RETURN NEW;
END; $function$;

UPDATE public.products SET status = 'approved' WHERE status = 'pending';

-- 2. Seller profiles: verification info
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS ghana_card_number text,
  ADD COLUMN IF NOT EXISTS ghana_card_image_url text,
  ADD COLUMN IF NOT EXISTS address text;

-- 3. Auto-approve new seller applications
ALTER TABLE public.seller_profiles ALTER COLUMN status SET DEFAULT 'approved';
