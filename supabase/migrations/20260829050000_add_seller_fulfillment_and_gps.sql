-- Migration: Add Seller Dual Fulfillment Model & Live GPS Pickup Address fields

ALTER TABLE public.seller_profiles
ADD COLUMN IF NOT EXISTS fulfillment_model TEXT DEFAULT 'direct_pickup',
ADD COLUMN IF NOT EXISTS pickup_address TEXT,
ADD COLUMN IF NOT EXISTS pickup_landmark TEXT,
ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC,
ADD COLUMN IF NOT EXISTS pickup_phone TEXT;

COMMENT ON COLUMN public.seller_profiles.fulfillment_model IS 'Fulfillment choice: direct_pickup (rider picks up at seller location) OR hub_dropoff (seller drops item at hub)';
COMMENT ON COLUMN public.seller_profiles.pickup_latitude IS 'Live GPS latitude coordinate of seller pickup location';
COMMENT ON COLUMN public.seller_profiles.pickup_longitude IS 'Live GPS longitude coordinate of seller pickup location';
