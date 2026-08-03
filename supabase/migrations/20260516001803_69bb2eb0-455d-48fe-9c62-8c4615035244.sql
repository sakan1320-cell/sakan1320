CREATE OR REPLACE FUNCTION public.get_user_email_by_identifier(_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT email FROM auth.users 
  WHERE email = _identifier 
     OR raw_user_meta_data->>'username' = _identifier
     OR raw_user_meta_data->>'phone' = _identifier
  LIMIT 1;
$$;

-- Also check if identifier matches a participant's national_id or phone
CREATE OR REPLACE FUNCTION public.get_user_email_by_identifier(_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT u.email 
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.email = _identifier 
     OR p.username = _identifier
     OR p.phone = _identifier
     OR p.normalized_username = LOWER(_identifier)
  LIMIT 1;
$$;