-- Add online/offline availability and presence tracking to rider_profiles

-- 1. Add columns to rider_profiles
ALTER TABLE public.rider_profiles
ADD COLUMN IF NOT EXISTS is_online BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;

-- 2. Create index for fast status queries
CREATE INDEX IF NOT EXISTS idx_rider_profiles_is_online ON public.rider_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_rider_profiles_last_seen_at ON public.rider_profiles(last_seen_at);

-- 3. Ensure RLS policies allow riders to update their own profile presence
DROP POLICY IF EXISTS "Riders can update their own profile" ON public.rider_profiles;
CREATE POLICY "Riders can update their own profile"
  ON public.rider_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. RPC for updating rider presence atomically
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

  -- Ensure profile exists
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = _rider_id) THEN
    INSERT INTO public.rider_profiles (user_id, full_name, status, is_online, last_seen_at)
    VALUES (_rider_id, 'Rider', 'active', _is_online, now())
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Update presence
  UPDATE public.rider_profiles
  SET
    is_online = _is_online,
    last_seen_at = now(),
    current_lat = COALESCE(_lat, current_lat),
    current_lng = COALESCE(_lng, current_lng),
    updated_at = now()
  WHERE user_id = _rider_id
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
