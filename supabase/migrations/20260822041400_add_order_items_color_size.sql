-- Add selected_color and selected_size columns to public.order_items if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'selected_color'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN selected_color JSONB DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'order_items' AND column_name = 'selected_size'
  ) THEN
    ALTER TABLE public.order_items ADD COLUMN selected_size TEXT DEFAULT NULL;
  END IF;
END $$;
