-- ==============================================================================
-- Migration: 20260912023500_only_notify_paid_orders.sql
-- Description:
--   Ensures that customer order notifications and seller sale notifications
--   are ONLY sent when an order is actually paid/confirmed, never on pending/unpaid orders.
-- ==============================================================================

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
    -- Only notify customer if the order was created as paid or confirmed (e.g. after payment verification)
    IF NEW.payment_status = 'paid' OR NEW.status = 'confirmed' THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (
        NEW.user_id,
        'Order Confirmed 🎉',
        'Your order #' || short_id || ' has been paid and received successfully.',
        'order_update',
        NEW.id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- If order transitions from pending/unpaid to paid, notify customer
    IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.payment_status = 'paid') 
       OR (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'confirmed' AND OLD.status = 'pending') THEN
      INSERT INTO public.notifications (user_id, title, message, type, order_id)
      VALUES (
        NEW.user_id,
        'Order Confirmed 🎉',
        'Payment confirmed! Your order #' || short_id || ' is now being prepared.',
        'order_update',
        NEW.id
      );
      RETURN NEW;
    END IF;

    -- Status change notifications for customer (for other status transitions)
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'confirmed' THEN
      CASE LOWER(NEW.status)
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

    -- Rider assignment notifications (only for paid/confirmed orders)
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
