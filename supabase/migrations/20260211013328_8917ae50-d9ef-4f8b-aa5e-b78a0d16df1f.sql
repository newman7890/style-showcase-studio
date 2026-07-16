
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'order_update',
  is_read BOOLEAN NOT NULL DEFAULT false,
  order_id UUID REFERENCES public.orders(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow inserts via service role (trigger/edge function)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create a trigger function to auto-create notifications on order status change
CREATE OR REPLACE FUNCTION public.create_order_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  status_title TEXT;
  status_message TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'processing' THEN
        status_title := 'Order Processing 📦';
        status_message := 'Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' is now being processed!';
      WHEN 'shipped' THEN
        status_title := 'Order Shipped 🚚';
        status_message := 'Great news! Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' has been shipped!';
      WHEN 'delivered' THEN
        status_title := 'Order Delivered ✅';
        status_message := 'Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' has been delivered!';
      WHEN 'cancelled' THEN
        status_title := 'Order Cancelled ❌';
        status_message := 'Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' has been cancelled.';
      WHEN 'refunded' THEN
        status_title := 'Order Refunded 💰';
        status_message := 'Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' has been refunded.';
      ELSE
        status_title := 'Order Update';
        status_message := 'Your order #' || upper(substr(NEW.id::text, 1, 8)) || ' status changed to ' || NEW.status;
    END CASE;

    INSERT INTO public.notifications (user_id, title, message, type, order_id)
    VALUES (NEW.user_id, status_title, status_message, 'order_update', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_order_status_change_notification
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.create_order_notification();
