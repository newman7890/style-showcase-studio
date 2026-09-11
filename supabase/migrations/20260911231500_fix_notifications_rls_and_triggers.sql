-- ==============================================================================
-- Migration: 20260911231500_fix_notifications_rls_and_triggers.sql
-- Description:
--   1. Grant full RLS permissions on public.notifications (SELECT, INSERT, UPDATE, DELETE).
--   2. Add automated DB triggers for order creation, status progression, rider assignment,
--      seller sale alerts, and rider application status updates.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATIONS TABLE RLS REPAIR
-- ------------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, anon;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies on notifications
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notifications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- Permissive policies for notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT TO authenticated, anon
USING (
  auth.uid() = user_id
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "notifications_insert_policy" ON public.notifications
FOR INSERT TO authenticated, anon
WITH CHECK (
  auth.uid() = user_id
  OR auth.uid() IS NOT NULL
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR true
);

CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "notifications_delete_policy" ON public.notifications
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Ensure Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ------------------------------------------------------------------------------
-- 2. AUTOMATED ORDER ACTIVITY TRIGGER (CUSTOMER & RIDER NOTIFICATIONS)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  short_id TEXT;
  status_title TEXT;
  status_msg TEXT;
BEGIN
  short_id := upper(substr(NEW.id::text, 1, 8));

  IF TG_OP = 'INSERT' THEN
    -- Customer notification on new order placement
    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (
      NEW.user_id,
      'Order Placed! 🛍️',
      'Your order #' || short_id || ' has been received successfully.',
      'order_update',
      NEW.id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- 1. Status change notifications for customer
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      CASE LOWER(NEW.status)
        WHEN 'confirmed' THEN
          status_title := 'Order Confirmed 🎉';
          status_msg := 'Payment confirmed! Your order #' || short_id || ' is now being prepared.';
        WHEN 'processing' THEN
          status_title := 'Order Processing 📦';
          status_msg := 'Your order #' || short_id || ' is now packed and being processed.';
        WHEN 'ready_for_pickup' THEN
          status_title := 'Ready for Dispatch 🛵';
          status_msg := 'Order #' || short_id || ' is packaged and awaiting rider dispatch.';
        WHEN 'shipped', 'in_transit' THEN
          status_title := 'Order In Transit 🚚';
          status_msg := 'Order #' || short_id || ' is in transit with our logistics team.';
        WHEN 'out_for_delivery' THEN
          status_title := 'Out For Delivery 🚴';
          status_msg := 'Your rider is on the way with order #' || short_id || '!';
        WHEN 'delivered' THEN
          status_title := 'Order Delivered ✅';
          status_msg := 'Order #' || short_id || ' has been delivered successfully. Thank you for shopping with us!';
        WHEN 'cancelled' THEN
          status_title := 'Order Cancelled ⚠️';
          status_msg := 'Order #' || short_id || ' has been cancelled.';
        WHEN 'refunded' THEN
          status_title := 'Order Refunded 💰';
          status_msg := 'Order #' || short_id || ' has been refunded to your account.';
        ELSE
          status_title := 'Order Update';
          status_msg := 'Order #' || short_id || ' status changed to ' || NEW.status;
      END CASE;

      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (NEW.user_id, status_title, status_msg, 'order_update', NEW.id);
    END IF;

    -- 2. Rider assignment notifications
    IF (OLD.assigned_rider_id IS DISTINCT FROM NEW.assigned_rider_id) AND NEW.assigned_rider_id IS NOT NULL THEN
      -- Notify Rider
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (
        NEW.assigned_rider_id,
        'New Delivery Assigned 🚴',
        'You have been assigned order #' || short_id || ' for delivery.',
        'order_update',
        NEW.id
      );

      -- Notify Customer
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (
        NEW.user_id,
        'Rider Assigned 🚴',
        'A delivery rider has been assigned to your order #' || short_id || '.',
        'order_update',
        NEW.id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change_notification ON public.orders;
DROP TRIGGER IF EXISTS trg_order_activity_notification ON public.orders;

CREATE TRIGGER trg_order_activity_notification
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_order_activity();

-- ------------------------------------------------------------------------------
-- 3. SELLER SALES NOTIFICATION TRIGGER (WHEN ORDER ITEMS ARE PURCHASED)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_seller_new_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prod_name TEXT;
  short_order_id TEXT;
BEGIN
  IF NEW.seller_id IS NOT NULL THEN
    SELECT name INTO v_prod_name FROM public.products WHERE id = NEW.product_id;
    short_order_id := upper(substr(NEW.order_id::text, 1, 8));

    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (
      NEW.seller_id,
      'New Sale Received! 💰',
      'You received an order for ' || NEW.quantity || 'x ' || COALESCE(v_prod_name, 'item') || ' (Order #' || short_order_id || ').',
      'order_update',
      NEW.order_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_order_item_sale_notify ON public.order_items;
CREATE TRIGGER trg_on_order_item_sale_notify
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.notify_seller_new_sale();

-- ------------------------------------------------------------------------------
-- 4. RIDER APPLICATION STATUS CHANGE NOTIFICATION TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_rider_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Rider Account Approved 🚴',
        'Congratulations! Your rider application has been approved. You can now accept deliveries!',
        'seller_status'
      );
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Rider Application Update',
        'Your rider application was not approved. ' || COALESCE(NEW.rejection_reason, ''),
        'seller_status'
      );
    ELSIF NEW.status = 'suspended' THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (
        NEW.user_id,
        'Rider Account Suspended ⚠️',
        'Your rider account has been temporarily suspended. ' || COALESCE(NEW.rejection_reason, ''),
        'seller_status'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_rider_status_change ON public.rider_profiles;
CREATE TRIGGER trg_on_rider_status_change
AFTER UPDATE OF status ON public.rider_profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_rider_status_change();
