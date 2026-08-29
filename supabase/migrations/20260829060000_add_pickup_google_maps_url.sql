-- Migration: Add pickup_google_maps_url to seller_profiles

ALTER TABLE public.seller_profiles
ADD COLUMN IF NOT EXISTS pickup_google_maps_url TEXT;

COMMENT ON COLUMN public.seller_profiles.pickup_google_maps_url IS 'Google Maps or live location share link provided by seller for rider pickup directions';
