CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Use a high-entropy token (32 hex chars = 128 bits)
ALTER TABLE public.shared_wishlists
  ALTER COLUMN share_token SET DEFAULT replace(gen_random_uuid()::text, '-', '');

-- Regenerate any existing low-entropy tokens
UPDATE public.shared_wishlists
SET share_token = replace(gen_random_uuid()::text, '-', '')
WHERE length(share_token) < 24;