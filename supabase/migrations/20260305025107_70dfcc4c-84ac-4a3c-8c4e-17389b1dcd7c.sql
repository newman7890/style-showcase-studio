INSERT INTO public.user_roles (user_id, role)
VALUES ('521eb77f-eb74-4433-86bc-24ae8333171f', 'rider')
ON CONFLICT (user_id, role) DO NOTHING;