-- 1. Fix shared_wishlists exposing user_id: drop overly broad public SELECT policy.
-- Public access to wishlists is already handled via SECURITY DEFINER function get_shared_wishlist(_token).
DROP POLICY IF EXISTS "Anyone can view shared wishlists" ON public.shared_wishlists;

-- 2. Lock down SECURITY DEFINER functions exposed via PostgREST.
-- get_shared_wishlist and get_order_by_tracking_code are intentionally callable by anon/authenticated
-- (they are the safe replacements for direct table access), but we revoke broad EXECUTE and re-grant explicitly.
REVOKE EXECUTE ON FUNCTION public.get_shared_wishlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_wishlist(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_order_by_tracking_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_tracking_code(text) TO anon, authenticated;

-- Internal-only SECURITY DEFINER functions (triggers / helpers) should not be exposed to anon/authenticated.
REVOKE EXECUTE ON FUNCTION public.notify_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_order_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_tracking_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_tracking_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used in RLS policies; keep it executable but explicit
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

-- 3. Tighten public storage bucket listing: restrict storage.objects SELECT for product-images and avatars
-- to specific file access (no broad listing). Keep public read of individual objects.
-- Drop any overly broad public listing policies if present.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname IN (
        'Public can list product-images',
        'Public can list avatars',
        'Anyone can list product images',
        'Anyone can list avatars'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;