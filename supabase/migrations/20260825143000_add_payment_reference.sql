-- Add payment_reference column to orders table for idempotent payment tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Create index on payment_reference for fast lookup
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);
