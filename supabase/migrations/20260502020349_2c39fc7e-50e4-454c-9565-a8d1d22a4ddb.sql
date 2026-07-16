-- ============================================
-- DELIVERY FEES: defaults + duplicate guard
-- ============================================
ALTER TABLE public.delivery_fees
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Case-insensitive uniqueness on region (prevents "Greater Accra" vs "greater accra")
CREATE UNIQUE INDEX IF NOT EXISTS delivery_fees_region_lower_idx
  ON public.delivery_fees (lower(trim(region)));

-- Only one default row allowed
CREATE UNIQUE INDEX IF NOT EXISTS delivery_fees_only_one_default
  ON public.delivery_fees ((1)) WHERE is_default = true;

-- Insert a default fallback row if not present
INSERT INTO public.delivery_fees (region, fee, is_active, is_default)
SELECT 'Default', 50, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_fees WHERE is_default = true);

-- ============================================
-- DELIVERY FEE AUDIT LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_fee_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_fee_id UUID,
  action TEXT NOT NULL, -- 'created' | 'updated' | 'deleted'
  changed_by UUID,
  changed_by_email TEXT,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_fee_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view delivery fee audit" ON public.delivery_fee_audit;
CREATE POLICY "Admins can view delivery fee audit"
  ON public.delivery_fee_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert delivery fee audit" ON public.delivery_fee_audit;
CREATE POLICY "Admins can insert delivery fee audit"
  ON public.delivery_fee_audit FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function to log all changes automatically
CREATE OR REPLACE FUNCTION public.log_delivery_fee_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.delivery_fee_audit
      (delivery_fee_id, action, changed_by, changed_by_email, new_values)
    VALUES
      (NEW.id, 'created', auth.uid(), v_email, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.delivery_fee_audit
      (delivery_fee_id, action, changed_by, changed_by_email, old_values, new_values)
    VALUES
      (NEW.id, 'updated', auth.uid(), v_email, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.delivery_fee_audit
      (delivery_fee_id, action, changed_by, changed_by_email, old_values)
    VALUES
      (OLD.id, 'deleted', auth.uid(), v_email, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_fee_audit ON public.delivery_fees;
CREATE TRIGGER trg_delivery_fee_audit
AFTER INSERT OR UPDATE OR DELETE ON public.delivery_fees
FOR EACH ROW EXECUTE FUNCTION public.log_delivery_fee_change();

-- updated_at maintenance
DROP TRIGGER IF EXISTS trg_delivery_fees_updated_at ON public.delivery_fees;
CREATE TRIGGER trg_delivery_fees_updated_at
BEFORE UPDATE ON public.delivery_fees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DEPARTMENTS (Fashion / Gadgets / Home / Other)
-- ============================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'fashion';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS department TEXT NOT NULL DEFAULT 'fashion';

CREATE INDEX IF NOT EXISTS idx_products_department ON public.products(department);
CREATE INDEX IF NOT EXISTS idx_categories_department ON public.categories(department);

-- ============================================
-- FEE RESOLUTION FUNCTION (city → region → default)
-- ============================================
CREATE OR REPLACE FUNCTION public.resolve_delivery_fee(_region TEXT, _city TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fee NUMERIC;
BEGIN
  -- 1. Exact city + region match
  IF _city IS NOT NULL AND length(trim(_city)) > 0 THEN
    SELECT fee INTO v_fee
    FROM public.delivery_fees
    WHERE is_active = true
      AND lower(trim(region)) = lower(trim(_region))
      AND city IS NOT NULL
      AND lower(trim(city)) = lower(trim(_city))
    LIMIT 1;
    IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;
  END IF;

  -- 2. Region-only match (no city specified on the fee row)
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_active = true
    AND lower(trim(region)) = lower(trim(_region))
    AND (city IS NULL OR length(trim(city)) = 0)
  LIMIT 1;
  IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;

  -- 3. Any active row matching region (fallback)
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_active = true
    AND lower(trim(region)) = lower(trim(_region))
  ORDER BY city NULLS FIRST
  LIMIT 1;
  IF v_fee IS NOT NULL THEN RETURN v_fee; END IF;

  -- 4. Default row
  SELECT fee INTO v_fee
  FROM public.delivery_fees
  WHERE is_default = true AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_fee, 0);
END;
$$;