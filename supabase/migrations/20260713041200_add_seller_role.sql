-- 1. Add 'seller' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
COMMIT; -- necessary when adding enum values in some environments

-- 2. Add seller_id to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 3. Add RLS policies for sellers to manage their own products
CREATE POLICY "Sellers can insert their own products"
  ON public.products FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'seller'::app_role) AND seller_id = auth.uid());

CREATE POLICY "Sellers can update their own products"
  ON public.products FOR UPDATE
  USING (has_role(auth.uid(), 'seller'::app_role) AND seller_id = auth.uid());

CREATE POLICY "Sellers can delete their own products"
  ON public.products FOR DELETE
  USING (has_role(auth.uid(), 'seller'::app_role) AND seller_id = auth.uid());
