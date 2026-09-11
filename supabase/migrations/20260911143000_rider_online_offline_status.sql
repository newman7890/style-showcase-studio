-- Add online/offline availability, presence tracking, and strict suspension enforcement to rider_profiles

-- 1. Add columns to rider_profiles safely
ALTER TABLE public.rider_profiles
ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;

-- 2. Relax strict not-null constraints that could block upserting profiles
ALTER TABLE public.rider_profiles ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE public.rider_profiles ALTER COLUMN access_code DROP NOT NULL;

-- 3. Create indexes for fast status and presence queries
CREATE INDEX IF NOT EXISTS idx_rider_profiles_is_online ON public.rider_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_last_seen_at ON public.rider_profiles(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_status ON public.rider_profiles(status);

-- 4. Ensure RLS policies allow riders to view and update their own profile presence
DROP POLICY IF EXISTS "Riders can update their own profile" ON public.rider_profiles;
CREATE POLICY "Riders can update their own profile"
  ON public.rider_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Riders can insert their own profile" ON public.rider_profiles;
CREATE POLICY "Riders can insert their own profile"
  ON public.rider_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 5. RPC for updating rider presence atomically
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
  _updated_row public.rider_profiles%ROWTYPE;
BEGIN
  IF _rider_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Upsert presence row atomically
  INSERT INTO public.rider_profiles (
    user_id,
    full_name,
    phone_number,
    vehicle_type,
    access_code,
    status,
    is_online,
    last_seen_at,
    current_lat,
    current_lng,
    updated_at
  )
  VALUES (
    _rider_id,
    'Rider',
    '',
    'Motorcycle',
    'ONLINE',
    'active',
    _is_online,
    now(),
    _lat,
    _lng,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    is_online = EXCLUDED.is_online,
    last_seen_at = now(),
    current_lat = COALESCE(EXCLUDED.current_lat, rider_profiles.current_lat),
    current_lng = COALESCE(EXCLUDED.current_lng, rider_profiles.current_lng),
    updated_at = now()
  RETURNING * INTO _updated_row;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _rider_id,
    'is_online', _updated_row.is_online,
    'last_seen_at', _updated_row.last_seen_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_rider_presence(BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_rider_presence(BOOLEAN, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;

-- 6. Enforce suspension check strictly on rider profile status
CREATE OR REPLACE FUNCTION public.is_rider_suspended(_rider_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.rider_profiles
    WHERE user_id = _rider_id AND status = 'suspended'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_rider_suspended(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rider_suspended(UUID) TO anon;
