-- Make the unified login resolver resilient for staff and participant accounts.
-- It supports email, username, normalized username, national ID, and phone.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS is_password_setup_required BOOLEAN DEFAULT false;

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS username TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_identifier_username ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_identifier_normalized_username ON public.profiles (normalized_username);
CREATE INDEX IF NOT EXISTS idx_profiles_identifier_national_id ON public.profiles (national_id);
CREATE INDEX IF NOT EXISTS idx_participants_identifier_username ON public.participants (username);
CREATE INDEX IF NOT EXISTS idx_participants_identifier_auth_user_id ON public.participants (auth_user_id);

CREATE OR REPLACE FUNCTION public.get_user_email_by_identifier(_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth
AS $$
DECLARE
  ident TEXT := trim(coalesce(_identifier, ''));
  found_email TEXT;
BEGIN
  IF ident = '' THEN
    RETURN NULL;
  END IF;

  SELECT u.email
    INTO found_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.participants pa ON pa.auth_user_id = u.id
  WHERE lower(u.email) = lower(ident)
     OR p.username = ident
     OR p.normalized_username = lower(ident)
     OR p.national_id = ident
     OR p.phone = ident
     OR pa.username = ident
     OR pa.national_id = ident
     OR pa.phone = ident
     OR u.raw_user_meta_data->>'username' = ident
     OR lower(coalesce(u.raw_user_meta_data->>'username', '')) = lower(ident)
     OR u.raw_user_meta_data->>'national_id' = ident
     OR u.raw_user_meta_data->>'phone' = ident
  ORDER BY CASE
    WHEN lower(u.email) = lower(ident) THEN 0
    WHEN p.normalized_username = lower(ident) THEN 1
    WHEN p.username = ident THEN 2
    WHEN pa.username = ident THEN 3
    WHEN p.national_id = ident THEN 4
    WHEN pa.national_id = ident THEN 5
    ELSE 6
  END
  LIMIT 1;

  RETURN found_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_email_by_identifier(TEXT) TO anon, authenticated;
