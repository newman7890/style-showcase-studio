DROP POLICY IF EXISTS "Public can view approved products" ON public.products;
CREATE POLICY "Public can view approved products"
ON public.products
FOR SELECT
USING (
  status = 'approved'::product_status
  AND (
    seller_id IS NULL
    OR public.is_approved_seller(seller_id)
    OR public.has_role(seller_id, 'admin'::app_role)
  )
);