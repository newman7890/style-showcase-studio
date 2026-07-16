ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS payout_method TEXT NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS momo_provider TEXT,
  ADD COLUMN IF NOT EXISTS momo_number TEXT,
  ADD COLUMN IF NOT EXISTS momo_account_name TEXT;