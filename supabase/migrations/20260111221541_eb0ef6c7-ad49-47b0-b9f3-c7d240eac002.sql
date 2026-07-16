-- Create a function to notify on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    payload := json_build_object(
      'orderId', NEW.id,
      'newStatus', NEW.status,
      'oldStatus', OLD.status
    );
    
    -- Call the edge function using pg_net
    PERFORM net.http_post(
      url := 'https://rsxpoctivfhlacgmjawj.supabase.co/functions/v1/send-order-notification',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )::jsonb,
      body := payload::jsonb
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status_change();