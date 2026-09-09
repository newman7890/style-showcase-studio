-- Drop unique constraint on cart_items (user_id, product_id) if it exists
-- to allow customers to have multiple distinct variant configurations (color/size) of the same product in their cart.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cart_items_user_id_product_id_key'
  ) THEN
    ALTER TABLE public.cart_items DROP CONSTRAINT cart_items_user_id_product_id_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cart_items_user_id_product_id_unique'
  ) THEN
    ALTER TABLE public.cart_items DROP CONSTRAINT cart_items_user_id_product_id_unique;
  END IF;
END $$;
