-- Create delivery_fees table for region-based delivery fees
CREATE TABLE public.delivery_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  region TEXT NOT NULL UNIQUE,
  city TEXT,
  fee NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- Anyone can view active delivery fees (needed at checkout)
CREATE POLICY "Anyone can view active delivery fees"
  ON public.delivery_fees FOR SELECT
  USING (is_active = true);

-- Admins can manage all delivery fees
CREATE POLICY "Admins can manage delivery fees"
  ON public.delivery_fees FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger to update updated_at
CREATE TRIGGER update_delivery_fees_updated_at
  BEFORE UPDATE ON public.delivery_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with Ghana regions (default 0 fee, admin can update)
INSERT INTO public.delivery_fees (region, fee) VALUES
  ('Greater Accra', 30),
  ('Ashanti', 50),
  ('Western', 60),
  ('Central', 50),
  ('Eastern', 50),
  ('Volta', 70),
  ('Northern', 100),
  ('Upper East', 120),
  ('Upper West', 120),
  ('Bono', 80),
  ('Bono East', 80),
  ('Ahafo', 80),
  ('Oti', 90),
  ('Savannah', 100),
  ('North East', 110),
  ('Western North', 70);

-- Add delivery_fee column to orders for record-keeping
ALTER TABLE public.orders ADD COLUMN delivery_fee NUMERIC NOT NULL DEFAULT 0;