-- Fix: Drop old region-only unique constraints/indexes on delivery_fees
-- This allows multiple cities and towns under the same region (e.g. Greater Accra -> Accra -> East Legon, Osu, Madina, etc.)

-- Drop table constraint first
ALTER TABLE public.delivery_fees DROP CONSTRAINT IF EXISTS delivery_fees_region_key CASCADE;
ALTER TABLE public.delivery_fees DROP CONSTRAINT IF EXISTS delivery_fees_region_lower_idx CASCADE;

-- Drop indexes
DROP INDEX IF EXISTS public.delivery_fees_region_lower_idx CASCADE;
DROP INDEX IF EXISTS public.delivery_fees_region_key CASCADE;

-- Re-create composite unique index on (region, city, town)
DROP INDEX IF EXISTS public.delivery_fees_region_city_town_lower_idx;

CREATE UNIQUE INDEX delivery_fees_region_city_town_lower_idx
  ON public.delivery_fees (
    lower(trim(region)), 
    lower(trim(coalesce(city, ''))), 
    lower(trim(coalesce(town, '')))
  );
