-- Add images array column to products table
ALTER TABLE public.products
ADD COLUMN images text[] DEFAULT ARRAY[]::text[];

-- Update existing products to include their current image in the images array
UPDATE public.products
SET images = ARRAY[image]
WHERE images = ARRAY[]::text[];