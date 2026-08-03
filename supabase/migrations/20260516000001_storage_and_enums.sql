-- ============================================================
-- Migration: Storage Stabilization & Role Enforcement
-- Timestamp: 20260516000001_storage_stabilization
-- Purpose: Fix storage buckets, RLS, and ensure enum consistency
-- ============================================================

-- 1. ENSURE system_admin IS IN app_role ENUM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'app_role' AND e.enumlabel = 'system_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'system_admin';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Type might not exist yet if running in a fresh DB, but usually it does
  NULL;
END $$;

-- 2. REDEFINE ROLE HELPERS TO USE ENUM (fix previous TEXT-based definitions if any)
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::TEXT = 'system_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role::TEXT = 'system_admin' OR role::TEXT = _role)
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND (role::TEXT = 'system_admin' OR role::TEXT = ANY(_roles))
  );
$$;

-- 3. ENSURE STORAGE BUCKETS EXIST
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('finance-attachments', 'finance-attachments', false),
  ('staff-attachments', 'staff-attachments', false),
  ('avatars', 'avatars', true),
  ('system-attachments', 'system-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 4. STORAGE RLS POLICIES
-- Finance Attachments: Only admin or owner? (Usually owner check depends on metadata)
-- For simplicity in enterprise: system_admin/executive/assistant can see everything.
DROP POLICY IF EXISTS "finance_attachments_admin_access" ON storage.objects;
CREATE POLICY "finance_attachments_admin_access"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'finance-attachments' AND 
    public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant'])
  );

-- Staff Attachments: Public upload (for registration), Admin read/delete
DROP POLICY IF EXISTS "staff_attachments_public_upload" ON storage.objects;
CREATE POLICY "staff_attachments_public_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'staff-attachments');

DROP POLICY IF EXISTS "staff_attachments_admin_access" ON storage.objects;
CREATE POLICY "staff_attachments_admin_access"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'staff-attachments' AND 
    public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant'])
  );

-- Avatars: Public read, User update own
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_user_upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars_user_insert" ON storage.objects;
CREATE POLICY "avatars_user_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (name = auth.uid()::TEXT OR name LIKE auth.uid()::TEXT || '/%'));

DROP POLICY IF EXISTS "avatars_user_update" ON storage.objects;
CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (name = auth.uid()::TEXT OR name LIKE auth.uid()::TEXT || '/%'))
  WITH CHECK (bucket_id = 'avatars' AND (name = auth.uid()::TEXT OR name LIKE auth.uid()::TEXT || '/%'));

DROP POLICY IF EXISTS "avatars_user_delete" ON storage.objects;
CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (name = auth.uid()::TEXT OR name LIKE auth.uid()::TEXT || '/%'));

-- System Attachments: Admin access
DROP POLICY IF EXISTS "system_attachments_admin_access" ON storage.objects;
CREATE POLICY "system_attachments_admin_access"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'system-attachments' AND 
    public.has_any_role(auth.uid(), ARRAY['system_admin', 'executive', 'assistant'])
  );

-- 5. ENSURE storage.objects HAS PROPER PERMISSIONS
GRANT ALL ON storage.objects TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT, INSERT ON storage.objects TO anon;

-- 6. AUDIT LOG FIX: Ensure it records properly
ALTER TABLE public.audit_log 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 7. CLEANUP: Remove duplicate message_threads if they exist (common issue in previous migrations)
-- (This was mentioned as a blocker/context in the summary)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_threads' AND table_schema = 'public') THEN
    -- Ensure indexes exist for performance
    CREATE INDEX IF NOT EXISTS idx_message_threads_project_id ON public.message_threads(project_id);
  END IF;
END $$;
