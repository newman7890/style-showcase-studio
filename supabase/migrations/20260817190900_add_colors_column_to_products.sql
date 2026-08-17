-- Add missing 'colors' column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors JSONB DEFAULT '[]'::jsonb;
