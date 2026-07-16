-- Add stock column to products table for inventory management
ALTER TABLE public.products 
ADD COLUMN stock integer NOT NULL DEFAULT 0;

-- Add low_stock_threshold column to products table
ALTER TABLE public.products 
ADD COLUMN low_stock_threshold integer NOT NULL DEFAULT 5;