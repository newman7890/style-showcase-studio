-- Add selected_color and selected_size columns to public.cart_items table
ALTER TABLE public.cart_items 
  ADD COLUMN IF NOT EXISTS selected_color JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS selected_size TEXT DEFAULT NULL;
