-- Add payment_status column to public.orders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
  END IF;
END $$;

-- Update existing orders to 'paid' if status is confirmed, processing, shipped, or delivered
UPDATE public.orders
SET payment_status = 'paid'
WHERE status IN ('confirmed', 'processing', 'shipped', 'delivered');

-- Update pending orders to 'unpaid'
UPDATE public.orders
SET payment_status = 'unpaid'
WHERE status = 'pending' OR status IS NULL;
