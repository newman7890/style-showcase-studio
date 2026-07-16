
-- Create testimonials table
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Customer',
  avatar_url TEXT,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Anyone can view active testimonials
CREATE POLICY "Anyone can view active testimonials"
ON public.testimonials
FOR SELECT
USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage testimonials"
ON public.testimonials
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_testimonials_updated_at
BEFORE UPDATE ON public.testimonials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing testimonials
INSERT INTO public.testimonials (name, role, rating, text) VALUES
  ('Ama Mensah', 'Loyal Customer', 5, 'The quality is incredible. I''ve been wearing their t-shirts for months and they still look brand new. Definitely my go-to store now.'),
  ('Kwame Asante', 'Verified Buyer', 5, 'Fast delivery and the jackets fit perfectly. Customer service was super helpful when I needed to exchange a size.'),
  ('Efua Darko', 'Fashion Enthusiast', 4, 'Love the minimalist styles! The jeans are so comfortable and versatile. I get compliments every time I wear them.');
