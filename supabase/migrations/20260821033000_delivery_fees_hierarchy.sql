-- Migration to support Region -> City -> Town/Area hierarchy in delivery_fees
ALTER TABLE public.delivery_fees
  ADD COLUMN IF NOT EXISTS town TEXT;

-- Drop the old region-only unique index that blocked multiple cities/towns under the same region
DROP INDEX IF EXISTS public.delivery_fees_region_lower_idx;

-- Create composite unique index so multiple towns/cities can exist under the same region
CREATE UNIQUE INDEX IF NOT EXISTS delivery_fees_region_city_town_lower_idx
  ON public.delivery_fees (
    lower(trim(region)), 
    lower(trim(coalesce(city, ''))), 
    lower(trim(coalesce(town, '')))
  );

-- Add comment explaining town column
COMMENT ON COLUMN public.delivery_fees.town IS 'Specific town or sub-area within a city (e.g. East Legon, Osu, Madina, Spintex, Adum)';
