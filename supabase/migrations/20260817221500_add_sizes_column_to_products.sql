-- Add missing 'sizes' column to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes JSONB DEFAULT '[]'::jsonb;
