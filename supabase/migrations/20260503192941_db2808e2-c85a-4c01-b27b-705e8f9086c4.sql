-- 1) is_public flag on projects + public read policy
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "projects_public_read" ON public.projects;
CREATE POLICY "projects_public_read" ON public.projects
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- 2) attachment_url on staff registration requests
ALTER TABLE public.staff_registration_requests ADD COLUMN IF NOT EXISTS attachment_url text;

-- 3) app_settings table (key/value JSON)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_public_read" ON public.app_settings;
CREATE POLICY "app_settings_public_read" ON public.app_settings
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_admin_write" ON public.app_settings;
CREATE POLICY "app_settings_admin_write" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

-- Seed default registration settings
INSERT INTO public.app_settings (key, value)
VALUES ('staff_registration', '{"enabled": true, "slug": "register"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4) Private bucket for staff registration attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-attachments', 'staff-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone (incl. anon) can upload to this bucket (public registration form)
DROP POLICY IF EXISTS "staff_attach_public_upload" ON storage.objects;
CREATE POLICY "staff_attach_public_upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'staff-attachments');

-- Only executive/assistant can read uploaded files
DROP POLICY IF EXISTS "staff_attach_admin_read" ON storage.objects;
CREATE POLICY "staff_attach_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'staff-attachments'
         AND public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));

DROP POLICY IF EXISTS "staff_attach_admin_delete" ON storage.objects;
CREATE POLICY "staff_attach_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'staff-attachments'
         AND public.has_any_role(auth.uid(), ARRAY['executive','assistant']::public.app_role[]));