
-- 1) Ensure system_admin exists in app_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'system_admin') THEN
    ALTER TYPE public.app_role ADD VALUE 'system_admin';
  END IF;
END$$;

-- 2) Update Profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS display_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS display_name_en TEXT,
  ADD COLUMN IF NOT EXISTS is_password_setup_required BOOLEAN DEFAULT false;

-- Unique normalized username index
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_normalized_username ON public.profiles(normalized_username);

-- 3) Update Participants table
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS username TEXT;

-- 4) Add new permissions
INSERT INTO public.permissions (key, label_ar, label_en, category) VALUES
  ('manage_user_credentials', 'إدارة بيانات الدخول', 'Manage User Credentials', 'admin'),
  ('force_password_reset', 'فرض إعادة تعيين كلمة المرور', 'Force Password Reset', 'admin'),
  ('edit_username', 'تعديل اسم المستخدم', 'Edit Username', 'admin'),
  ('edit_display_name', 'تعديل الاسم المعروض', 'Edit Display Name', 'admin'),
  ('activate_accounts', 'تفعيل/تعطيل الحسابات', 'Activate/Deactivate Accounts', 'admin'),
  ('manage_settings', 'إدارة إعدادات النظام', 'Manage System Settings', 'admin'),
  ('manage_translations', 'إدارة الترجمات', 'Manage Translations', 'admin'),
  ('export_data', 'تصدير البيانات', 'Export Data', 'admin'),
  ('manage_homepage', 'إدارة الصفحة الرئيسية', 'Manage Homepage CMS', 'admin')
ON CONFLICT (key) DO NOTHING;

-- 5) Map permissions to system_admin and executive
-- System Admin gets all
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'system_admin'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

-- Executive gets some new ones
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'executive'::public.app_role, key FROM public.permissions
WHERE key IN ('edit_display_name', 'manage_homepage', 'manage_settings')
ON CONFLICT DO NOTHING;

-- 6) Helper function for username normalization
CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.normalized_username := LOWER(TRIM(NEW.username));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_normalize_username ON public.profiles;
CREATE TRIGGER trg_normalize_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_username();

-- 7) Global Admin Access Helper (if not already existing or to improve current ones)
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'system_admin');
$$;
