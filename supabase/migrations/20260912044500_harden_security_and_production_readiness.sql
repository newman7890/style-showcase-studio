-- ==============================================================================
-- Migration: 20260912044500_harden_security_and_production_readiness.sql
-- Description:
--   1. Notifications RLS Lockdown (revoke anon, eliminate wide-open inserts).
--   2. Rider Profile Privacy & Access Scoping (prevent public leak of phone, access codes, GPS).
--   3. Rider Presence Function Hardening (strict RBAC & suspension verification).
--   4. Atomic Stock/Inventory Management (atomic decrement RPC, order cancellation restore trigger).
--   5. Remove Hardcoded Admin Assignment in signup trigger.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. NOTIFICATIONS RLS LOCKDOWN
-- ------------------------------------------------------------------------------

-- Revoke any anonymous access on notifications table
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on notifications
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notifications' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname);
  END LOOP;
END $$;

-- 1.1 SELECT: Users can only view their own notifications or admins can view all
CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 1.2 INSERT: Client inserts strictly restricted to own user_id or admin (system triggers run with SECURITY DEFINER)
CREATE POLICY "notifications_insert_policy" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 1.3 UPDATE: Users can mark their own notifications as read
CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 1.4 DELETE: Users can delete their own notifications
CREATE POLICY "notifications_delete_policy" ON public.notifications
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- ------------------------------------------------------------------------------
-- 2. RIDER PROFILE PRIVACY & ACCESS SCOPING
-- ------------------------------------------------------------------------------

ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on rider_profiles
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='rider_profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.rider_profiles', pol.policyname);
  END LOOP;
END $$;

-- 2.1 SELECT: Riders view own profile, Admins view all, Customers view only assigned active delivery rider
CREATE POLICY "rider_profiles_select_policy" ON public.rider_profiles
FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.assigned_rider_id = rider_profiles.user_id
      AND o.user_id = auth.uid()
      AND o.status IN ('confirmed', 'processing', 'ready_for_pickup', 'shipped', 'in_transit', 'out_for_delivery')
  )
);

-- 2.2 INSERT: Riders can create own profile or Admins
CREATE POLICY "rider_profiles_insert_policy" ON public.rider_profiles
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2.3 UPDATE: Riders update own profile or Admins
CREATE POLICY "rider_profiles_update_policy" ON public.rider_profiles
FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2.4 DELETE: Admins only
CREATE POLICY "rider_profiles_delete_policy" ON public.rider_profiles
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2.5 Secure helper RPC to fetch sanitized rider details for customer order tracking (NEVER exposes access_code)
CREATE OR REPLACE FUNCTION public.get_assigned_rider_info(_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id UUID := auth.uid();
  _order RECORD;
  _rider RECORD;
BEGIN
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verify caller is either order owner, assigned rider, or admin
  IF _order.user_id != _caller_id AND _order.assigned_rider_id != _caller_id AND NOT public.has_role(_caller_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF _order.assigned_rider_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT full_name, phone_number, vehicle_type, current_lat, current_lng, is_online, last_seen_at
  INTO _rider
  FROM public.rider_profiles
  WHERE user_id = _order.assigned_rider_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'full_name', _rider.full_name,
    'phone_number', _rider.phone_number,
    'vehicle_type', _rider.vehicle_type,
    'current_lat', _rider.current_lat,
    'current_lng', _rider.current_lng,
    'is_online', _rider.is_online,
    'last_seen_at', _rider.last_seen_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assigned_rider_info(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_assigned_rider_info(UUID) FROM anon;

-- ------------------------------------------------------------------------------
-- 3. RIDER PRESENCE FUNCTION HARDENING
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_rider_presence(
  _is_online BOOLEAN,
  _lat DOUBLE PRECISION DEFAULT NULL,
  _lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rider_id UUID := auth.uid();
  _is_rider BOOLEAN;
  _is_admin BOOLEAN;
  _updated_row public.rider_profiles%ROWTYPE;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  _is_rider := public.has_role(_rider_id, 'rider'::app_role);
  _is_admin := public.has_role(_rider_id, 'admin'::app_role);

  IF NOT _is_rider AND NOT _is_admin THEN
    RAISE EXCEPTION 'Forbidden: User is not an authorized rider or admin';
  END IF;

  IF public.is_rider_suspended(_rider_id) THEN
    RAISE EXCEPTION 'Forbidden: Rider account is suspended';
  END IF;

  -- Update existing rider profile
  UPDATE public.rider_profiles
  SET
    is_online = _is_online,
    last_seen_at = now(),
    current_lat = COALESCE(_lat, current_lat),
    current_lng = COALESCE(_lng, current_lng),
    updated_at = now()
  WHERE user_id = _rider_id
  RETURNING * INTO _updated_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider profile not found. Please contact administration to complete rider registration.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _rider_id,
    'is_online', _updated_row.is_online,
    'last_seen_at', _updated_row.last_seen_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_rider_presence(BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_rider_presence(BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. ATOMIC STOCK / INVENTORY MANAGEMENT
-- ------------------------------------------------------------------------------

-- Atomic stock deduction function with row-level locking
CREATE OR REPLACE FUNCTION public.decrement_product_stock(_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item JSONB;
  _prod_id UUID;
  _qty INT;
  _color_name TEXT;
  _prod RECORD;
  _updated_colors JSONB;
BEGIN
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RETURN;
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _prod_id := (_item->>'product_id')::UUID;
    _qty := COALESCE((_item->>'quantity')::INT, 1);
    
    IF _item->>'selected_color' IS NOT NULL THEN
      IF jsonb_typeof(_item->'selected_color') = 'object' THEN
        _color_name := _item->'selected_color'->>'name';
      ELSIF jsonb_typeof(_item->'selected_color') = 'string' THEN
        _color_name := _item->>'selected_color';
      ELSE
        _color_name := NULL;
      END IF;
    ELSE
      _color_name := NULL;
    END IF;

    IF _prod_id IS NOT NULL AND _qty > 0 THEN
      -- Lock product row to prevent race conditions during concurrent checkouts
      SELECT * INTO _prod FROM public.products WHERE id = _prod_id FOR UPDATE;
      IF FOUND THEN
        IF _color_name IS NOT NULL AND _prod.colors IS NOT NULL AND jsonb_typeof(to_jsonb(_prod.colors)) = 'array' THEN
          SELECT jsonb_agg(
            CASE
              WHEN (c->>'name') ILIKE _color_name THEN
                jsonb_set(c, '{stock}', to_jsonb(GREATEST(0, COALESCE((c->>'stock')::INT, 0) - _qty)))
              ELSE c
            END
          ) INTO _updated_colors
          FROM jsonb_array_elements(to_jsonb(_prod.colors)) AS c;

          UPDATE public.products
          SET
            stock = GREATEST(0, COALESCE(stock, 0) - _qty),
            colors = _updated_colors,
            updated_at = now()
          WHERE id = _prod_id;
        ELSE
          UPDATE public.products
          SET
            stock = GREATEST(0, COALESCE(stock, 0) - _qty),
            updated_at = now()
          WHERE id = _prod_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(JSONB) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decrement_product_stock(JSONB) FROM anon;

-- Atomic stock restoration function for cancelled or refunded orders
CREATE OR REPLACE FUNCTION public.restore_order_stock(_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _item RECORD;
  _prod RECORD;
  _color_name TEXT;
  _updated_colors JSONB;
BEGIN
  IF _order_id IS NULL THEN
    RETURN;
  END IF;

  FOR _item IN SELECT product_id, quantity, selected_color FROM public.order_items WHERE order_id = _order_id LOOP
    IF _item.product_id IS NOT NULL AND _item.quantity > 0 THEN
      SELECT * INTO _prod FROM public.products WHERE id = _item.product_id FOR UPDATE;
      IF FOUND THEN
        IF _item.selected_color IS NOT NULL THEN
          IF jsonb_typeof(to_jsonb(_item.selected_color)) = 'object' THEN
            _color_name := _item.selected_color->>'name';
          ELSIF jsonb_typeof(to_jsonb(_item.selected_color)) = 'string' THEN
            _color_name := _item.selected_color#>>'{}';
          ELSE
            _color_name := NULL;
          END IF;
        ELSE
          _color_name := NULL;
        END IF;

        IF _color_name IS NOT NULL AND _prod.colors IS NOT NULL AND jsonb_typeof(to_jsonb(_prod.colors)) = 'array' THEN
          SELECT jsonb_agg(
            CASE
              WHEN (c->>'name') ILIKE _color_name THEN
                jsonb_set(c, '{stock}', to_jsonb(COALESCE((c->>'stock')::INT, 0) + _item.quantity))
              ELSE c
            END
          ) INTO _updated_colors
          FROM jsonb_array_elements(to_jsonb(_prod.colors)) AS c;

          UPDATE public.products
          SET
            stock = COALESCE(stock, 0) + _item.quantity,
            colors = _updated_colors,
            updated_at = now()
          WHERE id = _item.product_id;
        ELSE
          UPDATE public.products
          SET
            stock = COALESCE(stock, 0) + _item.quantity,
            updated_at = now()
          WHERE id = _item.product_id;
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_order_stock(UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.restore_order_stock(UUID) FROM anon;

-- Trigger to restore stock when an order is cancelled or refunded
CREATE OR REPLACE FUNCTION public.handle_order_cancellation_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.status NOT IN ('cancelled', 'refunded') AND NEW.status IN ('cancelled', 'refunded')) THEN
      PERFORM public.restore_order_stock(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_cancellation_stock ON public.orders;
CREATE TRIGGER trg_order_cancellation_stock
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_cancellation_stock();

-- ------------------------------------------------------------------------------
-- 5. REMOVE HARDCODED ADMIN ASSIGNMENT IN SIGNUP TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  
  -- Assign standard default 'user' role to all new registrations
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;
