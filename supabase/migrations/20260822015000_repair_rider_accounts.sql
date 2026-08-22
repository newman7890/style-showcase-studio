-- Retroactive repair for jonathandowning33@gmail.com and any riders registered before the trigger update
DO $$
DECLARE
  _uid uuid;
  _code text := 'RIDER-8669';
BEGIN
  -- Find user id for jonathandowning33@gmail.com
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'jonathandowning33@gmail.com';

  IF _uid IS NOT NULL THEN
    -- 1. Confirm email
    UPDATE auth.users SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) WHERE id = _uid;

    -- 2. Assign rider role
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'rider'::app_role) ON CONFLICT (user_id, role) DO NOTHING;

    -- 3. Create rider profile
    INSERT INTO public.rider_profiles (user_id, full_name, phone_number, vehicle_type, access_code, status)
    VALUES (_uid, 'James', '+233 24 000 0000', 'Motorcycle', _code, 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active', access_code = _code;

    -- 4. Mark access code as used
    UPDATE public.rider_access_codes SET is_used = true, used_by = _uid, used_at = NOW() WHERE upper(code) = _code;
  END IF;
END;
$$;
