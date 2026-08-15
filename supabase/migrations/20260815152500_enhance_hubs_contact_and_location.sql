-- Enhance hubs table with contact_email, operating_hours, dropoff_instructions, and google_maps_url
ALTER TABLE public.hubs
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT 'Mon - Fri: 8:00 AM - 5:00 PM',
  ADD COLUMN IF NOT EXISTS dropoff_instructions TEXT DEFAULT 'Present your Seller ID and item package to the hub receiving dock clerk.',
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
