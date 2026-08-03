-- إضافة الأعمدة الجديدة لجدول حقول الهيكلة
ALTER TABLE public.registration_form_fields 
ADD COLUMN IF NOT EXISTS system_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS tab_section TEXT DEFAULT 'info';

-- إضافة حقل boolean للأنواع المدعومة (لحقل إنشاء الحساب)
ALTER TABLE public.registration_form_fields
DROP CONSTRAINT IF EXISTS registration_form_fields_field_type_check;

ALTER TABLE public.registration_form_fields
ADD CONSTRAINT registration_form_fields_field_type_check 
CHECK (field_type IN ('text', 'number', 'date', 'select', 'boolean'));

-- إدراج الحقول الأساسية بشكل افتراضي إذا لم تكن موجودة
INSERT INTO public.registration_form_fields (system_key, name_ar, field_type, is_required, tab_section, order_index, is_active)
VALUES 
    ('full_name', 'الاسم الكامل', 'text', true, 'info', 10, true),
    ('national_id', 'رقم الهوية', 'text', true, 'info', 20, true),
    ('phone', 'رقم الجوال', 'text', true, 'info', 30, true),
    ('date_of_birth', 'تاريخ الميلاد', 'date', false, 'info', 40, true),
    ('gender', 'الجنس', 'select', false, 'info', 50, true),
    ('email', 'البريد الإلكتروني', 'text', false, 'info', 60, true),
    ('project_id', 'المشروع', 'select', false, 'info', 70, true),
    ('create_account', 'إنشاء حساب دخول للمشترك', 'boolean', false, 'info', 80, true),
    ('notes', 'ملاحظات', 'text', false, 'info', 90, true),
    
    ('guardian_name', 'اسم ولي الأمر', 'text', false, 'guardian', 100, true),
    ('guardian_phone', 'رقم جوال ولي الأمر', 'text', false, 'guardian', 110, true),
    ('guardian_relation', 'صلة القرابة', 'select', false, 'guardian', 120, true),
    ('guardian_email', 'البريد الإلكتروني لولي الأمر', 'text', false, 'guardian', 130, true),
    ('guardian_national_id', 'رقم هوية ولي الأمر', 'text', false, 'guardian', 140, true),
    ('guardian_notes', 'ملاحظات ولي الأمر', 'text', false, 'guardian', 150, true)
ON CONFLICT (system_key) DO NOTHING;
