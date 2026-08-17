-- Update notify_order_status_change to dynamically fetch Supabase URL from app settings or environment
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  supabase_url TEXT;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    payload := json_build_object(
      'orderId', NEW.id,
      'newStatus', NEW.status,
      'oldStatus', OLD.status
    );
    
    -- Attempt to get configured supabase url or fallback to header origin / null safety
    supabase_url := coalesce(
      current_setting('app.settings.supabase_url', true),
      'https://' || current_setting('request.headers', true)::json->>'host'
    );
    
    -- Call the edge function using pg_net if URL is available
    IF supabase_url IS NOT NULL AND supabase_url != 'https://' THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-order-notification',
        headers := json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        )::jsonb,
        body := payload::jsonb
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
