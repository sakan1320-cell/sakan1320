-- 1. Insert permission key for changing user passwords
INSERT INTO public.permissions (key, label_ar, label_en, category)
VALUES (
  'change_user_password',
  'تغيير الرمز السري للمستخدمين والمشاركين',
  'Change User and Participant Password',
  'admin'
)
ON CONFLICT (key) DO NOTHING;

-- 2. Grant the permission to system_admin role
INSERT INTO public.role_permissions (role, permission_key)
VALUES ('system_admin'::public.app_role, 'change_user_password')
ON CONFLICT DO NOTHING;

-- 3. Create the security definer function to update passwords safely
CREATE OR REPLACE FUNCTION public.admin_change_user_password(target_user_id UUID, new_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- 1. Check if caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Check if caller has the required permission (or is system_admin)
  IF NOT public.user_has_permission(auth.uid(), 'change_user_password') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- 3. Check password length
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- 4. Update password in auth.users table
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  -- 5. Force is_password_setup_required to false on public.profiles
  UPDATE public.profiles
  SET is_password_setup_required = false,
      updated_at = now()
  WHERE id = target_user_id;

  RETURN TRUE;
END;
$$;

-- 4. Grant EXECUTE to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_change_user_password(UUID, TEXT) TO authenticated;
