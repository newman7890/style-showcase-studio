-- Use a high-entropy token (32 hex chars = 128 bits)
ALTER TABLE public.shared_wishlists
  ALTER COLUMN share_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

-- Regenerate any existing low-entropy tokens
UPDATE public.shared_wishlists
SET share_token = encode(gen_random_bytes(16), 'hex')
WHERE length(share_token) < 24;