-- Lock down delivery_fee_audit: no updates/deletes even for admins (audit immutability)
CREATE POLICY "No one can update delivery fee audit"
ON public.delivery_fee_audit FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "No one can delete delivery fee audit"
ON public.delivery_fee_audit FOR DELETE TO authenticated USING (false);

-- Restrict deletion of seller_profiles to admins only
CREATE POLICY "Admins can delete seller profiles"
ON public.seller_profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));