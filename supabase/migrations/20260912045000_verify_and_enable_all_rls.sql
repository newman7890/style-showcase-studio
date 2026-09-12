-- ==============================================================================
-- Migration: 20260912045000_verify_and_enable_all_rls.sql
-- Description:
--   1. Automatically enable ROW LEVEL SECURITY on all public tables.
--   2. Explicitly revoke anonymous privileges on sensitive tables.
--   3. Ensure public storefront tables (products, categories, delivery_fees, marketing_banners)
--      have clean, scoped SELECT policies for anon and authenticated users.
-- ==============================================================================

-- 1. Enable RLS on every single public table
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'pg_%' 
      AND tablename NOT LIKE '_prisma%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t.tablename);
  END LOOP;
END $$;

-- 2. Dynamically Revoke all privileges from anon on all sensitive tables that exist
DO $$
DECLARE
  tbl_name TEXT;
  sensitive_tables TEXT[] := ARRAY[
    'notifications',
    'orders',
    'order_items',
    'user_roles',
    'seller_profiles',
    'rider_profiles',
    'rider_access_codes',
    'seller_payouts',
    'seller_earnings',
    'cart_items',
    'delivery_fee_audit',
    'support_tickets',
    'audit_logs'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY sensitive_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl_name) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon;', tbl_name);
    END IF;
  END LOOP;
END $$;

-- 3. Ensure Storefront Tables are Publicly Readable (Read-Only)
DO $$
DECLARE
  tbl_name TEXT;
  public_tables TEXT[] := ARRAY[
    'products',
    'categories',
    'delivery_fees',
    'marketing_banners',
    'app_settings',
    'flash_deals'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY public_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl_name) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', tbl_name);
    END IF;
  END LOOP;
END $$;
