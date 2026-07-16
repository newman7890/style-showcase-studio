
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image text,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active categories" ON public.categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.categories
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert some default categories
INSERT INTO public.categories (name, slug, image, display_order) VALUES
  ('T-Shirts', 't-shirts', 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', 1),
  ('Jeans', 'jeans', 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=400&fit=crop', 2),
  ('Jackets', 'jackets', 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=400&fit=crop', 3),
  ('Shoes', 'shoes', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop', 4);
