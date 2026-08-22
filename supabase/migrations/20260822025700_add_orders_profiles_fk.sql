-- Add foreign key constraint between orders.user_id and public.profiles.id
-- This allows PostgREST schema cache to automatically resolve joins between orders and profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add foreign key constraint between orders.assigned_rider_id and public.profiles.id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'orders_assigned_rider_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_assigned_rider_id_profiles_fkey
      FOREIGN KEY (assigned_rider_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
