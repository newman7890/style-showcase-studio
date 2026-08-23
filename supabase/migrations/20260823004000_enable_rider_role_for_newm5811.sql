-- Ensure newm5811@gmail.com is fully provisioned with rider role, confirmed email, and active rider profile
DO $$
DECLARE
  _uid uuid;
  _code text := 'RIDER-5811';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = 'newm5811@gmail.com';

  IF _uid IS NOT NULL THEN
    -- 1. Confirm email if unconfirmed
    UPDATE auth.users 
    SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()) 
    WHERE id = _uid;

    -- 2. Assign rider role in user_roles (alongside existing admin/user roles)
    INSERT INTO public.user_roles (user_id, role) 
    VALUES (_uid, 'rider'::app_role) 
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 3. Create active rider profile entry
    INSERT INTO public.rider_profiles (user_id, full_name, phone_number, vehicle_type, access_code, status)
    VALUES (_uid, 'Newman Admin Rider', '+233 24 581 1000', 'Motorcycle', _code, 'active')
    ON CONFLICT (user_id) DO UPDATE SET status = 'active';

  END IF;
END;
$$;
