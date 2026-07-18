
-- Rider order update: add WITH CHECK restricting to same row (trigger still enforces column immutability)
DROP POLICY IF EXISTS "Riders can update order status" ON public.orders;
CREATE POLICY "Riders can update order status"
ON public.orders
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'rider'::app_role))
WITH CHECK (has_role(auth.uid(), 'rider'::app_role));

-- Consolidate duplicate seller policies on products
DROP POLICY IF EXISTS "Sellers can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
DROP POLICY IF EXISTS "Approved sellers can insert own products" ON public.products;

CREATE POLICY "Sellers can insert own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = seller_id AND is_approved_seller(auth.uid()));

CREATE POLICY "Sellers can update own products"
ON public.products FOR UPDATE TO authenticated
USING (auth.uid() = seller_id)
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own products"
ON public.products FOR DELETE TO authenticated
USING (auth.uid() = seller_id);
