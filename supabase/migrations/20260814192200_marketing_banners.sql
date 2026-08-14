-- Create marketing_banners table
CREATE TABLE IF NOT EXISTS public.marketing_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  link_url TEXT DEFAULT '/products',
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

-- Anyone can view active banners
CREATE POLICY "Anyone can view active marketing banners"
  ON public.marketing_banners FOR SELECT
  USING (is_active = true);

-- Admins can manage banners
CREATE POLICY "Admins can manage marketing banners"
  ON public.marketing_banners FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
