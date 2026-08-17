-- Internal trigger functions: not callable by API roles
REVOKE ALL ON FUNCTION public.enforce_order_pricing() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_product_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_seller_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_product_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_seller_profile_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.restrict_rider_order_updates() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.snapshot_order_item_pricing() FROM PUBLIC, anon, authenticated;

-- Helper functions used inside RLS policies: keep API roles, drop blanket PUBLIC grant
REVOKE ALL ON FUNCTION public.is_approved_seller(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_approved_seller(uuid) TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.seller_can_view_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_can_view_order(uuid) TO anon, authenticated, service_role;

-- Earnings summary: signed-in users only (function itself enforces ownership/admin)
REVOKE ALL ON FUNCTION public.get_seller_earnings_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_earnings_summary(uuid) TO authenticated, service_role;

-- Rider code redemption requires an authenticated session
REVOKE ALL ON FUNCTION public.consume_rider_access_code(text) FROM anon;
