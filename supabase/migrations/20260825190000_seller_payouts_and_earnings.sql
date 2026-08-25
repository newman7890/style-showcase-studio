-- Migration for Seller Earnings and Seller Payouts tracking
CREATE TABLE IF NOT EXISTS public.seller_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  gross_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  platform_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  payout_reference TEXT UNIQUE,
  payout_method TEXT DEFAULT 'paystack_subaccount',
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.seller_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_payouts ENABLE ROW LEVEL SECURITY;

-- Policies for seller_earnings
CREATE POLICY "Admins can manage all seller earnings"
  ON public.seller_earnings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view own earnings"
  ON public.seller_earnings
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Policies for seller_payouts
CREATE POLICY "Admins can manage all seller payouts"
  ON public.seller_payouts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sellers can view own payouts"
  ON public.seller_payouts
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS seller_earnings_seller_id_idx ON public.seller_earnings(seller_id);
CREATE INDEX IF NOT EXISTS seller_earnings_order_id_idx ON public.seller_earnings(order_id);
CREATE INDEX IF NOT EXISTS seller_payouts_seller_id_idx ON public.seller_payouts(seller_id);

-- RPC to record seller earnings when an order is created
CREATE OR REPLACE FUNCTION public.record_order_seller_earnings(_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item RECORD;
  _product_seller UUID;
  _commission_rate NUMERIC(5,2) := 0.10; -- 10% platform commission
  _item_total NUMERIC(10,2);
  _fee NUMERIC(10,2);
  _net NUMERIC(10,2);
BEGIN
  FOR _item IN 
    SELECT oi.id AS item_id, oi.product_id, oi.quantity, oi.price
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    SELECT seller_id INTO _product_seller
    FROM public.products
    WHERE id = _item.product_id;

    IF _product_seller IS NOT NULL THEN
      _item_total := _item.price * _item.quantity;
      _fee := ROUND(_item_total * _commission_rate, 2);
      _net := _item_total - _fee;

      INSERT INTO public.seller_earnings (
        order_id, order_item_id, seller_id, gross_amount, platform_fee, net_amount, status
      )
      VALUES (
        _order_id, _item.item_id, _product_seller, _item_total, _fee, _net, 'pending'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_order_seller_earnings(UUID) TO authenticated, service_role;
