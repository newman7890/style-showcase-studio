UPDATE public.seller_profiles
SET status = 'approved',
    approved_at = COALESCE(approved_at, now()),
    rejection_reason = NULL
WHERE user_id = '521eb77f-eb74-4433-86bc-24ae8333171f'
  AND business_name = 'Store'
  AND status = 'suspended';