-- Create discount codes table
CREATE TABLE public.discount_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL CHECK (discount_value > 0),
  min_order_amount NUMERIC DEFAULT 0,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Policy for admins to manage discount codes
CREATE POLICY "Admins can manage discount codes"
ON public.discount_codes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy for anyone to read active discount codes (for validation)
CREATE POLICY "Anyone can read active discount codes for validation"
ON public.discount_codes
FOR SELECT
USING (is_active = true);

-- Create table for tracking discount usage per user
CREATE TABLE public.discount_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  discount_code_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id),
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discount_usage ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own discount usage
CREATE POLICY "Users can see their own discount usage"
ON public.discount_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for admins to see all discount usage
CREATE POLICY "Admins can see all discount usage"
ON public.discount_usage
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy for users to insert their discount usage
CREATE POLICY "Users can insert their discount usage"
ON public.discount_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add discount columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS discount_code TEXT,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add a description column to products for AI-generated descriptions
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS description TEXT;