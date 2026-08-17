DROP POLICY IF EXISTS "Anyone can view hub inventory" ON public.hub_inventory;
CREATE POLICY "Admins and approved sellers can view hub inventory"
ON public.hub_inventory FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.is_approved_seller(auth.uid()));
REVOKE SELECT ON public.hub_inventory FROM anon;

DROP POLICY IF EXISTS "Anyone can verify active unused access codes" ON public.rider_access_codes;
DROP POLICY IF EXISTS "Riders can update access code when registering" ON public.rider_access_codes;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.rider_access_codes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.rider_access_codes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rider_access_codes TO authenticated;
GRANT ALL ON public.rider_access_codes TO service_role;