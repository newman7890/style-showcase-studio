INSERT INTO public.user_roles (user_id, role)
SELECT '521eb77f-eb74-4433-86bc-24ae8333171f', 'rider'
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = '521eb77f-eb74-4433-86bc-24ae8333171f')
ON CONFLICT (user_id, role) DO NOTHING;