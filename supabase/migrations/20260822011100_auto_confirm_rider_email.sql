-- Enforce 1 access code = 1 rider profile maximum
ALTER TABLE public.rider_profiles DROP CONSTRAINT IF EXISTS rider_profiles_access_code_key;
ALTER TABLE public.rider_profiles ADD CONSTRAINT rider_profiles_access_code_key UNIQUE (access_code);

-- Update handle_new_user() trigger function to strictly validate and consume rider access codes.
-- If an access code is invalid or already used, registration aborts immediately with an exception.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _full_name text;
  _phone text;
  _vehicle text;
  _valid boolean := false;
BEGIN
  -- Always insert basic profile
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Check if registering with rider access code in user metadata
  _code := NEW.raw_user_meta_data->>'access_code';

  IF _code IS NOT NULL AND length(trim(_code)) > 0 THEN
    _code := upper(trim(_code));
    
    -- Check if code exists and is unused
    SELECT EXISTS (
      SELECT 1 FROM public.rider_access_codes
      WHERE upper(code) = _code
        AND COALESCE(is_used, false) = false
    ) INTO _valid;

    IF NOT _valid THEN
      RAISE EXCEPTION 'Invalid or already used rider access code: %', _code;
    END IF;

    -- 1. Auto-confirm email (no verification needed since admin gave them the code)
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = NEW.id;

    -- 2. Assign 'rider' role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'rider'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 3. Create rider_profiles entry
    _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Rider');
    _phone := COALESCE(NEW.raw_user_meta_data->>'phone_number', '');
    _vehicle := COALESCE(NEW.raw_user_meta_data->>'vehicle_type', 'Motorcycle');

    INSERT INTO public.rider_profiles (user_id, full_name, phone_number, vehicle_type, access_code, status)
    VALUES (NEW.id, _full_name, _phone, _vehicle, _code, 'active');

    -- 4. Mark code as used
    UPDATE public.rider_access_codes
    SET is_used = true, used_by = NEW.id, used_at = NOW()
    WHERE upper(code) = _code;

    RETURN NEW;
  END IF;

  -- Default: Assign 'user' role for non-rider signups
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
