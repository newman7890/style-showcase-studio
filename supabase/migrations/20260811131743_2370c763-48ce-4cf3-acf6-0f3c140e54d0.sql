ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS materials_info text,
  ADD COLUMN IF NOT EXISTS size_fit_info text,
  ADD COLUMN IF NOT EXISTS shipping_returns_info text;