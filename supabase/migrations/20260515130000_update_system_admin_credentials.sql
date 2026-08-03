-- Update system admin account to sakan1320@gmail.com
-- Password is set via scripts/update-system-admin.cjs (Admin API) or Supabase Dashboard.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  admin_id uuid;
  new_email text := 'sakan1320@gmail.com';
  new_username text := 'sakan1320';
  new_password text := 'sakan1320@gmail.com';
BEGIN
  SELECT u.id INTO admin_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.email IN ('admin@sakansa.com', 'sakan1320@gmail.com')
     OR p.username = 'admin'
     OR p.normalized_username = 'admin'
  ORDER BY CASE WHEN u.email = 'admin@sakansa.com' THEN 0 ELSE 1 END
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'No existing admin user found; create one via Supabase Auth or scripts/update-system-admin.cjs';
    RETURN;
  END IF;

  UPDATE auth.users
  SET
    email = new_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', new_email),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = admin_id;

  UPDATE auth.identities
  SET
    provider_id = new_email,
    identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', new_email, 'sub', admin_id::text)
  WHERE user_id = admin_id AND provider = 'email';

  UPDATE public.profiles
  SET
    email = new_email,
    username = new_username,
    normalized_username = lower(new_username)
  WHERE id = admin_id;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = admin_id AND role = 'system_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_id, 'system_admin');
  END IF;

  RAISE NOTICE 'System admin updated: % (user_id: %)', new_email, admin_id;
END $$;