-- Migration to add shipping_town column to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_town TEXT;
