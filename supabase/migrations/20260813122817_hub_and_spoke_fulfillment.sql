-- Create hubs table
CREATE TABLE IF NOT EXISTS public.hubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on hubs
ALTER TABLE public.hubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active hubs"
  ON public.hubs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage hubs"
  ON public.hubs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create hub_inventory table
CREATE TABLE IF NOT EXISTS public.hub_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hub_id UUID NOT NULL REFERENCES public.hubs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hub_id, product_id)
);

-- Enable RLS on hub_inventory
ALTER TABLE public.hub_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view hub inventory"
  ON public.hub_inventory FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage hub inventory"
  ON public.hub_inventory FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create seller_dropoffs table
CREATE TABLE IF NOT EXISTS public.seller_dropoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hub_id UUID NOT NULL REFERENCES public.hubs(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on seller_dropoffs
ALTER TABLE public.seller_dropoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own dropoffs"
  ON public.seller_dropoffs FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create dropoffs"
  ON public.seller_dropoffs FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins can view and update all dropoffs"
  ON public.seller_dropoffs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create seller_dropoff_items table
CREATE TABLE IF NOT EXISTS public.seller_dropoff_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dropoff_id UUID NOT NULL REFERENCES public.seller_dropoffs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on seller_dropoff_items
ALTER TABLE public.seller_dropoff_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own dropoff items"
  ON public.seller_dropoff_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_dropoffs
      WHERE id = dropoff_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can create dropoff items"
  ON public.seller_dropoff_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_dropoffs
      WHERE id = dropoff_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view and manage all dropoff items"
  ON public.seller_dropoff_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Alter order_items
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS origin_hub_id UUID REFERENCES public.hubs(id),
ADD COLUMN IF NOT EXISTS fulfillment_status TEXT DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'processing_at_hub', 'in_transit_between_hubs', 'ready_for_rider', 'out_for_delivery', 'delivered', 'cancelled'));
