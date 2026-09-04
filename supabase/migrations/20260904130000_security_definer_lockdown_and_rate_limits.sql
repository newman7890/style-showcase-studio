-- ==============================================================================
-- Migration: 20260904130000_security_definer_lockdown_and_rate_limits.sql
-- Description:
--   1. Revoke EXECUTE on all trigger-only SECURITY DEFINER functions from PUBLIC, anon, and authenticated.
--   2. Explicitly lock down RPC permissions (revoke from anon/PUBLIC, grant to authenticated/service_role).
--   3. Create global_rate_limits table & check_global_rate_limit() function for distributed edge rate limiting.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. LOCK DOWN TRIGGER FUNCTIONS
-- Trigger functions must ONLY be invoked internally by PostgreSQL triggers.
-- They must never be directly callable via PostgREST / public RPC.
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  func_names text[] := ARRAY[
    'handle_new_user',
    'generate_order_pickup_otp',
    'enforce_order_pricing',
    'on_product_status_change',
    'on_seller_status_change',
    'protect_product_fields',
    'protect_seller_profile_fields',
    'restrict_rider_order_updates',
    'snapshot_order_item_pricing',
    'recompute_order_total',
    'set_tracking_code',
    'update_updated_at_column',
    'update_rider_support_tickets_updated_at',
    'create_order_notification',
    'notify_order_status_change',
    'log_delivery_fee_change',
    'generate_tracking_code'
  ];
  f text;
  r record;
BEGIN
  FOREACH f IN ARRAY func_names LOOP
    FOR r IN (
      SELECT p.oid::regprocedure AS proc_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = f
    ) LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.proc_signature);
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. LOCK DOWN INTERNAL SENSITIVE HELPERS & RESTRICTED RPCS
-- ------------------------------------------------------------------------------

-- record_order_seller_earnings: strictly service_role
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'record_order_seller_earnings'
  ) LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.proc_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.proc_signature);
  END LOOP;
END $$;

-- has_role: authenticated and service_role
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'has_role'
  ) LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.proc_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.proc_signature);
  END LOOP;
END $$;

-- validate_discount_code: authenticated and service_role
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'validate_discount_code'
  ) LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.proc_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.proc_signature);
  END LOOP;
END $$;

-- resolve_delivery_fee: authenticated and service_role
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN (
    SELECT p.oid::regprocedure AS proc_signature
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'resolve_delivery_fee'
  ) LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.proc_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.proc_signature);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. RIDER & SELLER RPCS (AUTHENTICATED ONLY)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  rider_seller_funcs text[] := ARRAY[
    'claim_order_by_rider',
    'claim_delivery',
    'confirm_pickup_otp',
    'confirm_delivery_otp',
    'mark_order_shipped_by_rider',
    'mark_order_delivered_by_rider',
    'is_rider_suspended',
    'consume_rider_access_code',
    'get_available_deliveries',
    'get_order_pickup_info',
    'get_delivery_otp_for_customer',
    'get_pickup_otp_for_seller',
    'get_seller_earnings_summary',
    'is_approved_seller',
    'seller_can_view_order'
  ];
  f text;
  r record;
BEGIN
  FOREACH f IN ARRAY rider_seller_funcs LOOP
    FOR r IN (
      SELECT p.oid::regprocedure AS proc_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = f
    ) LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.proc_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.proc_signature);
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. INTENTIONAL PUBLIC RPCS (EXPLICITLY DOCUMENTED & GRANTED)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  public_funcs text[] := ARRAY[
    'get_order_by_tracking_code',
    'get_shared_wishlist',
    'get_product_reviews',
    'increment_banner_click',
    'verify_rider_access_code',
    'get_public_seller_info'
  ];
  f text;
  r record;
BEGIN
  FOREACH f IN ARRAY public_funcs LOOP
    FOR r IN (
      SELECT p.oid::regprocedure AS proc_signature
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = f
    ) LOOP
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.proc_signature);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated, service_role', r.proc_signature);
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. GLOBALLY SYNCHRONIZED RATE LIMITING TABLE & ATOMIC RPC
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.global_rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Protect table with RLS so clients cannot query or modify it directly
ALTER TABLE public.global_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic sliding-window rate limit checker
CREATE OR REPLACE FUNCTION public.check_global_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_allowed BOOLEAN := true;
  v_remaining INTEGER := 0;
  v_reset_in_sec INTEGER := 0;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'reset_in_sec', 60);
  END IF;

  INSERT INTO public.global_rate_limits (key, request_count, window_start, updated_at)
  VALUES (p_key, 1, v_now, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    request_count = CASE
      WHEN global_rate_limits.window_start + (p_window_seconds || ' seconds')::interval < v_now THEN 1
      ELSE global_rate_limits.request_count + 1
    END,
    window_start = CASE
      WHEN global_rate_limits.window_start + (p_window_seconds || ' seconds')::interval < v_now THEN v_now
      ELSE global_rate_limits.window_start
    END,
    updated_at = v_now
  RETURNING window_start, request_count INTO v_window_start, v_count;

  IF v_count > p_max_requests THEN
    v_allowed := false;
    v_remaining := 0;
    v_reset_in_sec := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds || ' seconds')::interval - v_now)))::integer);
  ELSE
    v_allowed := true;
    v_remaining := p_max_requests - v_count;
    v_reset_in_sec := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'reset_in_sec', v_reset_in_sec
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_global_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_global_rate_limit(TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- Periodic cleanup function for stale rate limit records
CREATE OR REPLACE FUNCTION public.cleanup_stale_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.global_rate_limits
  WHERE updated_at < clock_timestamp() - INTERVAL '2 hours';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_rate_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_rate_limits() TO service_role;
