ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS normalized_username TEXT,
  ADD COLUMN IF NOT EXISTS display_name_ar TEXT,
  ADD COLUMN IF NOT EXISTS display_name_en TEXT,
  ADD COLUMN IF NOT EXISTS is_password_setup_required BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_normalized_username ON public.profiles(normalized_username);

ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS username TEXT;

INSERT INTO public.permissions (key, label_ar, label_en, category) VALUES
  ('manage_user_credentials', 'إدارة بيانات الدخول', 'Manage User Credentials', 'admin'),
  ('force_password_reset', 'فرض إعادة تعيين كلمة المرور', 'Force Password Reset', 'admin'),
  ('edit_username', 'تعديل اسم المستخدم', 'Edit Username', 'admin'),
  ('edit_display_name', 'تعديل الاسم المعروض', 'Edit Display Name', 'admin'),
  ('activate_accounts', 'تفعيل/تعطيل الحسابات', 'Activate/Deactivate Accounts', 'admin'),
  ('manage_settings', 'إدارة إعدادات النظام', 'Manage System Settings', 'admin'),
  ('manage_translations', 'إدارة الترجمات', 'Manage Translations', 'admin'),
  ('export_data', 'تصدير البيانات', 'Export Data', 'admin')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'system_admin'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key)
SELECT 'executive'::public.app_role, key FROM public.permissions
WHERE key IN ('edit_display_name', 'manage_homepage', 'manage_settings')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.normalize_username()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS NOT NULL THEN
    NEW.normalized_username := LOWER(TRIM(NEW.username));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_username ON public.profiles;
CREATE TRIGGER trg_normalize_username
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_username();