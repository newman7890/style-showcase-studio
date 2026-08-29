-- Add Paystack secret & public key fields to platform_settings table
ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS paystack_secret_key TEXT,
ADD COLUMN IF NOT EXISTS paystack_public_key TEXT;
