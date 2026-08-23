-- Fix notify_order_status_change to safely handle request.headers jsonb parsing without throwing operator does not exist
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
  supabase_url TEXT := NULL;
  headers_raw TEXT := NULL;
BEGIN
  -- Only trigger on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    payload := json_build_object(
      'orderId', NEW.id,
      'newStatus', NEW.status,
      'oldStatus', OLD.status
    );
    
    -- Attempt to get configured app setting
    BEGIN
      supabase_url := current_setting('app.settings.supabase_url', true);
    EXCEPTION WHEN OTHERS THEN
      supabase_url := NULL;
    END;
    
    -- Fallback to request headers if available
    IF supabase_url IS NULL OR length(trim(supabase_url)) = 0 THEN
      BEGIN
        headers_raw := current_setting('request.headers', true);
        IF headers_raw IS NOT NULL AND length(trim(headers_raw)) > 0 THEN
          supabase_url := 'https://' || (headers_raw::jsonb ->> 'host');
        END IF;
      EXCEPTION WHEN OTHERS THEN
        supabase_url := NULL;
      END;
    END IF;
    
    -- Call edge function if URL is valid
    IF supabase_url IS NOT NULL AND supabase_url != 'https://' AND length(trim(supabase_url)) > 8 THEN
      BEGIN
        PERFORM net.http_post(
          url := supabase_url || '/functions/v1/send-order-notification',
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || COALESCE(current_setting('app.settings.service_role_key', true), '')
          )::jsonb,
          body := payload::jsonb
        );
      EXCEPTION WHEN OTHERS THEN
        -- Ignore net.http_post failures so order status update never fails
        NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
