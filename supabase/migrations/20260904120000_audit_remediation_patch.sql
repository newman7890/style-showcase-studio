-- ==============================================================================
-- Migration: Additional Audit Remediation & Hardening Patch
-- ==============================================================================

-- 1. ENFORCE POSITIVE ORDER QUANTITIES AT THE DATABASE LEVEL
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS chk_order_items_positive_quantity;

ALTER TABLE public.order_items
  ADD CONSTRAINT chk_order_items_positive_quantity CHECK (quantity > 0 AND quantity <= 100);

-- 2. RESTRICT UNASSIGNED ORDERS VIEWING EXCLUSIVELY TO VERIFIED RIDERS AND ADMINS
-- Ensures regular customers cannot see unassigned orders or other customers' delivery locations
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;

CREATE POLICY "Riders can view unassigned and assigned orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'rider'::app_role)
    AND NOT public.is_rider_suspended(auth.uid()) 
    AND (
      (
        assigned_rider_id IS NULL 
        AND (payment_status = 'paid' OR status IN ('confirmed', 'processing', 'shipped'))
        AND status NOT IN ('pending', 'delivered', 'cancelled', 'refunded')
      )
      OR assigned_rider_id = auth.uid()
    )
  );

-- 3. RESTRICT PRODUCT IMAGE UPLOADS TO APPROVED SELLERS AND ADMINS
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Approved sellers and admins upload product images" ON storage.objects;

CREATE POLICY "Approved sellers and admins upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.seller_profiles
        WHERE user_id = auth.uid()
          AND status = 'approved'
      )
    )
  );
