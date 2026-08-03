-- ============================================================
-- Migration: System Stabilization & Admin Setup
-- Timestamp: 20260515_system_stabilization
-- Purpose: Fix auth, roles, RLS, and ensure admin account
-- ============================================================

-- ============================================================
-- 1. ENSURE has_role FUNCTION EXISTS (used by edge functions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = _role
  );
$$;

-- ============================================================
-- 2. ENSURE get_user_email_by_identifier EXISTS & IS CORRECT
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_email_by_identifier(_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    found_email TEXT;
BEGIN
    -- Search in profiles for username, national_id, or normalized_username
    SELECT u.email INTO found_email
    FROM auth.users u
    JOIN public.profiles p ON u.id = p.id
    WHERE p.username = _identifier 
       OR p.national_id = _identifier 
       OR p.normalized_username = LOWER(_identifier)
    LIMIT 1;

    RETURN found_email;
END;
$$;

-- ============================================================
-- 3. ENSURE profiles TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS display_name_en TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS national_id TEXT,
  ADD COLUMN IF NOT EXISTS is_password_setup_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure unique constraints (safe with IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_normalized_username_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_normalized_username_key UNIQUE (normalized_username);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Unique constraints already exist or cannot be added: %', SQLERRM;
END $$;

-- ============================================================
-- 4. HANDLE_NEW_USER TRIGGER (create profile on signup)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 5. SYNC PROFILE EMAIL ON AUTH UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- ============================================================
-- 6. RLS POLICIES FOR PROFILES (ensure basics exist)
-- ============================================================
-- Drop and recreate to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
  DROP POLICY IF EXISTS "staff_manage_profiles" ON public.profiles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "staff_manage_profiles" ON public.profiles;
CREATE POLICY "staff_manage_profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('system_admin', 'executive', 'assistant')
    )
  );

-- ============================================================
-- 7. RLS POLICIES FOR USER_ROLES
-- ============================================================
DO $$
BEGIN
  DROP POLICY IF EXISTS "Roles are viewable by authenticated" ON public.user_roles;
  DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
  DROP POLICY IF EXISTS "user_roles_manage" ON public.user_roles;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "user_roles_manage" ON public.user_roles;
CREATE POLICY "user_roles_manage"
  ON public.user_roles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('system_admin', 'executive')
    )
  );

-- ============================================================
-- 8. ENSURE ADMIN ACCOUNT EXISTS AND HAS CORRECT ROLES
-- ============================================================
DO $$
DECLARE
  admin_id UUID;
  target_email TEXT := 'sakan1320@gmail.com';
BEGIN
  -- Find the user
  SELECT id INTO admin_id
  FROM auth.users
  WHERE email = target_email
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'Admin user % not found in auth.users. Create via Supabase Dashboard or Admin API.', target_email;
    RETURN;
  END IF;

  -- Ensure profile exists
  INSERT INTO public.profiles (id, full_name, email, username, normalized_username)
  VALUES (admin_id, 'مدير النظام', target_email, 'sakan1320', 'sakan1320')
  ON CONFLICT (id) DO UPDATE SET
    email = target_email,
    username = COALESCE(public.profiles.username, 'sakan1320'),
    normalized_username = COALESCE(public.profiles.normalized_username, 'sakan1320'),
    is_password_setup_required = false;

  -- Ensure system_admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'system_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Ensure executive role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'executive')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Confirm email if not confirmed
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = admin_id AND email_confirmed_at IS NULL;

  RAISE NOTICE 'Admin account stabilized: % (id: %)', target_email, admin_id;
END $$;

-- ============================================================
-- 9. ENSURE ROLE_PERMISSIONS TABLE EXISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (role, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
  DROP POLICY IF EXISTS "role_permissions_manage" ON public.role_permissions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select"
  ON public.role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "role_permissions_manage" ON public.role_permissions;
CREATE POLICY "role_permissions_manage"
  ON public.role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('system_admin', 'executive')
    )
  );

-- ============================================================
-- 10. ENSURE USER_PERMISSIONS TABLE EXISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "user_permissions_select" ON public.user_permissions;
  DROP POLICY IF EXISTS "user_permissions_manage" ON public.user_permissions;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "user_permissions_select" ON public.user_permissions;
CREATE POLICY "user_permissions_select"
  ON public.user_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "user_permissions_manage" ON public.user_permissions;
CREATE POLICY "user_permissions_manage"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('system_admin', 'executive')
    )
  );

-- ============================================================
-- 11. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_normalized_username ON public.profiles(normalized_username);
CREATE INDEX IF NOT EXISTS idx_profiles_national_id ON public.profiles(national_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ============================================================
-- DONE
-- ============================================================
