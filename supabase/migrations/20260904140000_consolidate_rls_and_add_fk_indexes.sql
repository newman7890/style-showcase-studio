-- ==============================================================================
-- Migration: 20260904140000_consolidate_rls_and_add_fk_indexes.sql
-- Description:
--   1. Add high-performance B-Tree indexes on all foreign key and query columns.
--   2. Clean up legacy/sprawling policies and consolidate RLS across core tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HIGH-PERFORMANCE FOREIGN KEY & QUERY INDEXES
-- ------------------------------------------------------------------------------

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_rider_id ON public.orders(assigned_rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_reference ON public.orders(payment_reference);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON public.orders(tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Order Items table indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON public.order_items(seller_id);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- User roles & Profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON public.seller_profiles(status);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_user_id ON public.rider_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_status ON public.rider_profiles(status);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_access_code ON public.rider_profiles(access_code);

-- Seller financials indexes
CREATE INDEX IF NOT EXISTS idx_seller_earnings_seller_id ON public.seller_earnings(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_order_id ON public.seller_earnings(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_earnings_status ON public.seller_earnings(status);
CREATE INDEX IF NOT EXISTS idx_seller_payouts_seller_id ON public.seller_payouts(seller_id);

-- Cart & Favorites & Reviews indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON public.favorites(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews(user_id);

-- Support tickets & Rate limits
CREATE INDEX IF NOT EXISTS idx_rider_support_tickets_rider_id ON public.rider_support_tickets(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_support_tickets_order_id ON public.rider_support_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_global_rate_limits_updated_at ON public.global_rate_limits(updated_at);

-- ------------------------------------------------------------------------------
-- 2. CONSOLIDATE AND HARDEN RLS ON ORDERS
-- ------------------------------------------------------------------------------

-- Drop legacy/redundant order policies
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can view orders by tracking code" ON public.orders;
DROP POLICY IF EXISTS "Riders can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can update order status" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view orders containing their items" ON public.orders;
DROP POLICY IF EXISTS "Riders can view assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can update assigned order status" ON public.orders;
DROP POLICY IF EXISTS "Riders can view unassigned and assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON public.orders;

-- Recreate clean, consolidated policies for orders
CREATE POLICY "orders_select_policy" ON public.orders
FOR SELECT TO authenticated
USING (
  -- Customer owns the order
  auth.uid() = user_id
  -- Admin full access
  OR public.has_role(auth.uid(), 'admin'::app_role)
  -- Seller can view orders containing their items
  OR public.seller_can_view_order(id)
  -- Rider can view assigned orders or eligible unassigned orders
  OR (
    public.has_role(auth.uid(), 'rider'::app_role)
    AND NOT public.is_rider_suspended(auth.uid())
    AND (
      assigned_rider_id = auth.uid()
      OR (
        assigned_rider_id IS NULL
        AND (
          status IN ('processing', 'pending', 'ready_for_pickup')
          OR (payment_method IN ('momo', 'card') AND payment_status = 'paid')
        )
      )
    )
  )
);

CREATE POLICY "orders_insert_policy" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "orders_update_policy" ON public.orders
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'rider'::app_role)
    AND NOT public.is_rider_suspended(auth.uid())
    AND assigned_rider_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    public.has_role(auth.uid(), 'rider'::app_role)
    AND NOT public.is_rider_suspended(auth.uid())
    AND assigned_rider_id = auth.uid()
  )
);

CREATE POLICY "orders_delete_policy" ON public.orders
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- ------------------------------------------------------------------------------
-- 3. CONSOLIDATE AND HARDEN RLS ON ORDER_ITEMS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Riders can view all order items" ON public.order_items;
DROP POLICY IF EXISTS "Sellers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Riders can view assigned order items" ON public.order_items;
DROP POLICY IF EXISTS "Riders can view order items" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON public.order_items;
DROP POLICY IF EXISTS "order_items_update_delete_policy" ON public.order_items;

CREATE POLICY "order_items_select_policy" ON public.order_items
FOR SELECT TO authenticated
USING (
  -- Customer owns the order
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
  -- Seller owns the item
  OR auth.uid() = seller_id
  -- Admin full access
  OR public.has_role(auth.uid(), 'admin'::app_role)
  -- Rider can view items for relevant orders
  OR (
    public.has_role(auth.uid(), 'rider'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.assigned_rider_id = auth.uid()
          OR (
            orders.assigned_rider_id IS NULL
            AND orders.status IN ('processing', 'pending', 'ready_for_pickup')
          )
        )
    )
  )
);

CREATE POLICY "order_items_insert_policy" ON public.order_items
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "order_items_update_delete_policy" ON public.order_items
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- ------------------------------------------------------------------------------
-- 4. CONSOLIDATE AND HARDEN RLS ON PRODUCTS
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products" ON public.products;
DROP POLICY IF EXISTS "Sellers can view own products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Approved sellers can insert own products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert their own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can insert own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON public.products;
DROP POLICY IF EXISTS "Admins can update any product" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete own products" ON public.products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete any product" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "products_select_policy" ON public.products;
DROP POLICY IF EXISTS "products_insert_policy" ON public.products;
DROP POLICY IF EXISTS "products_update_policy" ON public.products;
DROP POLICY IF EXISTS "products_delete_policy" ON public.products;

CREATE POLICY "products_select_policy" ON public.products
FOR SELECT
USING (
  -- Public can view approved products from active sellers or platform
  (status = 'approved' AND (seller_id IS NULL OR public.is_approved_seller(seller_id)))
  -- Sellers can view all their own products (including pending/rejected)
  OR (auth.uid() IS NOT NULL AND auth.uid() = seller_id)
  -- Admins can view all products
  OR (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "products_insert_policy" ON public.products
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = seller_id AND public.is_approved_seller(auth.uid()))
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "products_update_policy" ON public.products
FOR UPDATE TO authenticated
USING (
  auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "products_delete_policy" ON public.products
FOR DELETE TO authenticated
USING (
  auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
