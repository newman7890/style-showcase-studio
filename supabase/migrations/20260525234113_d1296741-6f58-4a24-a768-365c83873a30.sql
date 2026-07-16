
-- Revoke EXECUTE from anon and authenticated on all SECURITY DEFINER functions,
-- then re-grant only where required.

-- 1. Trigger-only functions: revoke from everyone (triggers run as table owner regardless).
REVOKE EXECUTE ON FUNCTION public.set_tracking_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tracking_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_delivery_fee_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_order_total() FROM PUBLIC, anon, authenticated;

-- 2. Internal helpers used by RLS / authenticated flows only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_discount_code(text, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_delivery_fee(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_delivery_fee(text, text) TO authenticated;

-- 3. Public-facing RPCs: keep callable by anon and authenticated (this is intentional).
REVOKE EXECUTE ON FUNCTION public.get_order_by_tracking_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_shared_wishlist(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_product_reviews(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_wishlist(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(uuid) TO anon, authenticated;
