
-- Replace the overly permissive INSERT policy with a restrictive one
-- Notifications are inserted by the SECURITY DEFINER trigger, so no user INSERT needed
DROP POLICY "Service role can insert notifications" ON public.notifications;
