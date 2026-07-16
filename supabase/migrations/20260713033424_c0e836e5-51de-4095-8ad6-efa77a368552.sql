
-- =========================================================================
-- MARKETPLACE PART 2: tables, RLS, triggers, backfill
-- =========================================================================

-- platform_settings ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  default_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00 CHECK (default_commission_percent >= 0 AND default_commission_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);
GRANT SELECT ON public.platform_settings TO authenticated, anon;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert platform settings"
  ON public.platform_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.platform_settings (id, default_commission_percent)
VALUES (1, 10.00) ON CONFLICT (id) DO NOTHING;

-- seller_profiles --------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.seller_status AS ENUM ('pending','approved','rejected','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  phone TEXT,
  bio TEXT,
  bank_code TEXT,
  account_number TEXT,
  account_name TEXT,
  paystack_subaccount_code TEXT,
  status public.seller_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  commission_override NUMERIC(5,2) CHECK (commission_override IS NULL OR (commission_override >= 0 AND commission_override <= 100)),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.seller_profiles TO authenticated;
GRANT SELECT ON public.seller_profiles TO anon;
GRANT ALL ON public.seller_profiles TO service_role;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved sellers"
  ON public.seller_profiles FOR SELECT USING (status = 'approved');
CREATE POLICY "Sellers can view own profile"
  ON public.seller_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all seller profiles"
  ON public.seller_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can apply as seller"
  ON public.seller_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Sellers can update own profile"
  ON public.seller_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update any seller profile"
  ON public.seller_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_seller_profiles_updated
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.protect_seller_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.status := OLD.status;
  NEW.paystack_subaccount_code := OLD.paystack_subaccount_code;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.commission_override := OLD.commission_override;
  NEW.approved_at := OLD.approved_at;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_seller_profile
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_profile_fields();

CREATE OR REPLACE FUNCTION public.on_seller_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    NEW.approved_at := COALESCE(NEW.approved_at, now());
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.user_id, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
    INSERT INTO public.notifications(user_id, title, message, type)
    VALUES (NEW.user_id, 'Seller application approved 🎉',
      'Your seller application has been approved. You can now list products.', 'seller_status');
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    INSERT INTO public.notifications(user_id, title, message, type)
    VALUES (NEW.user_id, 'Seller application rejected',
      COALESCE('Reason: ' || NEW.rejection_reason, 'Your seller application was rejected.'), 'seller_status');
  ELSIF NEW.status = 'suspended' AND (OLD.status IS DISTINCT FROM 'suspended') THEN
    INSERT INTO public.notifications(user_id, title, message, type)
    VALUES (NEW.user_id, 'Seller account suspended',
      COALESCE('Reason: ' || NEW.rejection_reason, 'Your seller account has been suspended.'), 'seller_status');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_on_seller_status_change
  BEFORE UPDATE OF status ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_seller_status_change();

-- products: add seller_id + status ---------------------------------------
DO $$ BEGIN
  CREATE TYPE public.product_status AS ENUM ('pending','approved','rejected','hidden');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status public.product_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DO $$
DECLARE admin_uid UUID;
BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_uid IS NOT NULL THEN
    UPDATE public.products SET seller_id = admin_uid WHERE seller_id IS NULL;
    INSERT INTO public.seller_profiles (user_id, business_name, status, approved_at)
    VALUES (admin_uid, 'Store', 'approved', now())
    ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.user_roles(user_id, role) VALUES (admin_uid, 'seller')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  UPDATE public.products SET status = 'approved' WHERE status = 'pending';
END $$;

CREATE OR REPLACE FUNCTION public.is_approved_seller(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.seller_profiles WHERE user_id = _user_id AND status = 'approved');
$$;
GRANT EXECUTE ON FUNCTION public.is_approved_seller(uuid) TO authenticated, anon;

-- Drop any existing products SELECT policies before adding new ones
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='products' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Public can view approved products"
  ON public.products FOR SELECT
  USING (status = 'approved' AND (seller_id IS NULL OR public.is_approved_seller(seller_id)));
CREATE POLICY "Sellers can view own products"
  ON public.products FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all products"
  ON public.products FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Approved sellers can insert own products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = seller_id AND public.is_approved_seller(auth.uid()));
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers can update own products"
  ON public.products FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Admins can update any product"
  ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Sellers can delete own products"
  ON public.products FOR DELETE TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Admins can delete any product"
  ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.protect_product_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  NEW.status := OLD.status;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.seller_id := OLD.seller_id;
  IF (NEW.price IS DISTINCT FROM OLD.price
      OR NEW.name IS DISTINCT FROM OLD.name
      OR NEW.description IS DISTINCT FROM OLD.description
      OR NEW.image IS DISTINCT FROM OLD.image)
     AND OLD.status = 'approved' THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_product_fields
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_fields();

CREATE OR REPLACE FUNCTION public.on_product_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.seller_id IS NOT NULL THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications(user_id, title, message, type)
      VALUES (NEW.seller_id, 'Product approved ✅',
        'Your product "' || NEW.name || '" is now live.', 'product_status');
    ELSIF NEW.status = 'rejected' THEN
      INSERT INTO public.notifications(user_id, title, message, type)
      VALUES (NEW.seller_id, 'Product rejected',
        'Your product "' || NEW.name || '" was rejected. ' || COALESCE(NEW.rejection_reason,''), 'product_status');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_on_product_status_change
  AFTER UPDATE OF status ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.on_product_status_change();

-- order_items snapshot ---------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS seller_earnings NUMERIC(12,2);

CREATE OR REPLACE FUNCTION public.snapshot_order_item_pricing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_price NUMERIC; v_seller UUID; v_pct NUMERIC; v_override NUMERIC; v_gross NUMERIC;
BEGIN
  SELECT price, seller_id INTO v_price, v_seller FROM public.products WHERE id = NEW.product_id;
  NEW.unit_price := COALESCE(v_price, 0);
  NEW.seller_id := v_seller;
  SELECT commission_override INTO v_override FROM public.seller_profiles WHERE user_id = v_seller;
  IF v_override IS NOT NULL THEN v_pct := v_override;
  ELSE SELECT default_commission_percent INTO v_pct FROM public.platform_settings WHERE id = 1;
  END IF;
  v_pct := COALESCE(v_pct, 10);
  v_gross := NEW.unit_price * NEW.quantity;
  NEW.commission_percent := v_pct;
  NEW.commission_amount := ROUND(v_gross * (v_pct/100.0), 2);
  NEW.seller_earnings := v_gross - NEW.commission_amount;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_snapshot_order_item ON public.order_items;
CREATE TRIGGER trg_snapshot_order_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_pricing();

CREATE POLICY "Sellers can view own order items"
  ON public.order_items FOR SELECT TO authenticated USING (auth.uid() = seller_id);

CREATE OR REPLACE FUNCTION public.seller_can_view_order(_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = _order_id AND seller_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.seller_can_view_order(uuid) TO authenticated;
CREATE POLICY "Sellers can view orders containing their items"
  ON public.orders FOR SELECT TO authenticated USING (public.seller_can_view_order(id));

-- payout_ledger ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gross_amount NUMERIC(12,2) NOT NULL,
  commission_amount NUMERIC(12,2) NOT NULL,
  seller_earnings NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  paystack_reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_ledger TO authenticated;
GRANT ALL ON public.payout_ledger TO service_role;
ALTER TABLE public.payout_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers can view own payouts"
  ON public.payout_ledger FOR SELECT TO authenticated USING (auth.uid() = seller_id);
CREATE POLICY "Admins can view all payouts"
  ON public.payout_ledger FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.get_seller_earnings_summary(_seller_id UUID)
RETURNS TABLE(total_orders BIGINT, total_gross NUMERIC, total_commission NUMERIC, total_earnings NUMERIC, pending_earnings NUMERIC, paid_earnings NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(DISTINCT oi.order_id)::BIGINT,
    COALESCE(SUM(oi.unit_price * oi.quantity),0),
    COALESCE(SUM(oi.commission_amount),0),
    COALESCE(SUM(oi.seller_earnings),0),
    COALESCE(SUM(CASE WHEN pl.status IS NULL OR pl.status = 'pending' THEN oi.seller_earnings ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN pl.status = 'paid' THEN oi.seller_earnings ELSE 0 END),0)
  FROM public.order_items oi
  LEFT JOIN public.payout_ledger pl ON pl.order_item_id = oi.id
  WHERE oi.seller_id = _seller_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_seller_earnings_summary(uuid) TO authenticated;
