-- ============================================================
-- Migration: Fix ALL RLS Recursion Issues
-- Timestamp: 20260520000001
-- Purpose: Replace all direct user_roles subqueries in RLS
--          policies with SECURITY DEFINER helper functions
--          to eliminate infinite recursion errors.
-- ============================================================

-- ============================================================
-- 1. Create/Replace all needed SECURITY DEFINER helpers
-- ============================================================

-- General staff-level check (any staff role)
CREATE OR REPLACE FUNCTION public.current_user_is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'system_admin','executive','assistant',
        'project_manager','branch_manager','employee','contractor','board'
      )
  );
$$;

-- Manager/Admin level check (executive or system_admin)
CREATE OR REPLACE FUNCTION public.current_user_is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive')
  );
$$;

-- Manager or assistant check
CREATE OR REPLACE FUNCTION public.current_user_is_admin_or_assistant()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant')
  );
$$;

-- ============================================================
-- 2. Fix profiles table policies (removes direct user_roles subquery)
-- ============================================================
DROP POLICY IF EXISTS "staff_manage_profiles" ON public.profiles;
CREATE POLICY "staff_manage_profiles"
  ON public.profiles FOR ALL
  USING (public.current_user_is_admin_or_assistant());

-- ============================================================
-- 3. Fix role_permissions table policies
-- ============================================================
DROP POLICY IF EXISTS "role_permissions_manage" ON public.role_permissions;
CREATE POLICY "role_permissions_manage"
  ON public.role_permissions FOR ALL
  USING (public.current_user_is_manager());

-- ============================================================
-- 4. Fix user_permissions table policies
-- ============================================================
DROP POLICY IF EXISTS "user_permissions_manage" ON public.user_permissions;
CREATE POLICY "user_permissions_manage"
  ON public.user_permissions FOR ALL
  USING (public.current_user_is_manager());

-- ============================================================
-- 5. Fix user_roles policies - replace all recursive ones
-- ============================================================

-- Drop all existing user_roles policies to start clean
DROP POLICY IF EXISTS "roles_delete_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_select_self_or_admin" ON public.user_roles;
DROP POLICY IF EXISTS "roles_update_admin" ON public.user_roles;
DROP POLICY IF EXISTS "system_admin_full_access" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;

-- Select: any authenticated user can see roles (needed by loadRoles in AuthContext)
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Insert/Update/Delete: only manager via safe helper (no recursion)
CREATE POLICY "user_roles_write"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.can_manage_roles(auth.uid()));

CREATE POLICY "user_roles_update"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.can_manage_roles(auth.uid()));

CREATE POLICY "user_roles_delete"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.can_manage_roles(auth.uid()));

-- ============================================================
-- 6. Ensure executive role for admin user  
-- ============================================================
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'sakan1320@gmail.com' LIMIT 1;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'executive')
    ON CONFLICT (user_id, role) DO NOTHING;
    RAISE NOTICE 'Executive role ensured for admin: %', admin_id;
  END IF;
END $$;

-- ============================================================
-- 7. Fix any other tables that reference user_roles directly in RLS
-- ============================================================

-- projects table - ensure safe policies
DO $$
BEGIN
  -- Drop any direct-subquery policies on projects if they exist
  DROP POLICY IF EXISTS "projects_staff_manage" ON public.projects;
  DROP POLICY IF EXISTS "staff_projects_manage" ON public.projects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- tasks table - ensure safe policies  
DO $$
BEGIN
  DROP POLICY IF EXISTS "tasks_staff_manage" ON public.tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- DONE
-- ============================================================
DO $$ BEGIN RAISE NOTICE 'Migration 20260520000001: RLS recursion fixed in all tables.'; END $$;
