-- ==============================================================================
-- Migration: 20260912045500_restrict_stock_rpcs_to_service_role.sql
-- Description:
--   1. Restrict public.decrement_product_stock to service_role ONLY.
--   2. Restrict public.restore_order_stock to service_role ONLY.
--   3. Add caller validation inside PL/pgSQL functions to reject non-service-role invocations.
-- ==============================================================================

-- 1. Redefine decrement_product_stock with internal caller role check
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
  _caller_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), (auth.jwt()->>'role'));
BEGIN
  -- Strict caller enforcement: only service_role or admin can invoke this sensitive RPC
  IF _caller_role IS DISTINCT FROM 'service_role' AND NOT (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden: decrement_product_stock can only be executed by service_role or admin';
  END IF;

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
      -- Row-level lock on product
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

-- Revoke execute from authenticated, anon, public
REVOKE ALL ON FUNCTION public.decrement_product_stock(JSONB) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.decrement_product_stock(JSONB) TO service_role;

-- 2. Redefine restore_order_stock with internal caller role check
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
  _caller_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), (auth.jwt()->>'role'));
BEGIN
  -- Strict caller enforcement: only service_role or admin can invoke this sensitive RPC
  IF _caller_role IS DISTINCT FROM 'service_role' AND NOT (auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden: restore_order_stock can only be executed by service_role or admin';
  END IF;

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

-- Revoke execute from authenticated, anon, public
REVOKE ALL ON FUNCTION public.restore_order_stock(UUID) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.restore_order_stock(UUID) TO service_role;
