-- Add missing granular permissions covering all modules
INSERT INTO public.permissions (key, label_ar, label_en, category) VALUES
  -- Branches
  ('view_branches', 'عرض الفروع', 'View branches', 'branches'),
  ('manage_branches', 'إدارة الفروع', 'Manage branches', 'branches'),
  -- Guardians
  ('view_guardians', 'عرض أولياء الأمور', 'View guardians', 'guardians'),
  ('manage_guardians', 'إدارة أولياء الأمور', 'Manage guardians', 'guardians'),
  -- LMS
  ('view_courses', 'عرض الدورات', 'View courses', 'lms'),
  ('manage_courses', 'إدارة الدورات', 'Manage courses', 'lms'),
  ('manage_quizzes', 'إدارة الاختبارات', 'Manage quizzes', 'lms'),
  ('issue_certificates', 'إصدار الشهادات', 'Issue certificates', 'lms'),
  -- Site / content
  ('manage_site_content', 'إدارة محتوى الموقع', 'Manage site content', 'site'),
  ('manage_settings', 'إدارة الإعدادات العامة', 'Manage app settings', 'site'),
  -- Templates
  ('manage_task_templates', 'إدارة قوالب المهام', 'Manage task templates', 'templates'),
  ('manage_project_templates', 'إدارة قوالب المشاريع', 'Manage project templates', 'templates'),
  ('manage_notification_templates', 'إدارة قوالب الإشعارات', 'Manage notification templates', 'templates'),
  -- Automations
  ('view_automations', 'عرض قواعد الأتمتة', 'View automation rules', 'automations'),
  ('manage_automations', 'إدارة قواعد الأتمتة', 'Manage automation rules', 'automations'),
  -- Staff requests
  ('view_staff_requests', 'عرض طلبات التوظيف', 'View staff requests', 'staff'),
  ('manage_staff_requests', 'مراجعة طلبات التوظيف', 'Review staff requests', 'staff'),
  -- Finance details
  ('view_finance_attachments', 'عرض مرفقات المالية', 'View finance attachments', 'finance'),
  ('upload_finance_attachments', 'رفع مرفقات المالية', 'Upload finance attachments', 'finance'),
  ('export_finance', 'تصدير التقارير المالية', 'Export finance reports', 'finance'),
  -- Attendance details
  ('export_attendance', 'تصدير الحضور', 'Export attendance', 'attendance'),
  ('mark_attendance', 'تسجيل الحضور اليومي', 'Mark daily attendance', 'attendance'),
  -- Participants details
  ('import_participants', 'استيراد المشاركين', 'Import participants', 'participants'),
  ('export_participants', 'تصدير المشاركين', 'Export participants', 'participants'),
  ('manage_participant_points', 'إدارة نقاط المشاركين', 'Manage participant points', 'participants'),
  -- Notifications
  ('send_bulk_notifications', 'إرسال إشعارات جماعية', 'Send bulk notifications', 'notifications'),
  -- Reports
  ('export_reports', 'تصدير التقارير', 'Export reports', 'reports'),
  -- Profile
  ('edit_own_profile', 'تعديل ملفي الشخصي', 'Edit own profile', 'general'),
  -- Tasks
  ('assign_tasks', 'إسناد المهام', 'Assign tasks', 'tasks'),
  ('comment_tasks', 'التعليق على المهام', 'Comment on tasks', 'tasks')
ON CONFLICT (key) DO NOTHING;

-- Grant ALL permissions to executive
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'executive'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

-- Grant ALL permissions to assistant
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'assistant'::public.app_role, key FROM public.permissions
WHERE key NOT IN ('manage_permissions','manage_users')
ON CONFLICT DO NOTHING;

-- Board: read-only on most things
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'board'::public.app_role, key FROM public.permissions
WHERE key LIKE 'view_%' OR key IN ('export_reports','export_finance','export_attendance','export_participants','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Project manager
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('project_manager','view_branches'),('project_manager','manage_branches'),
  ('project_manager','view_guardians'),('project_manager','manage_guardians'),
  ('project_manager','view_courses'),('project_manager','manage_courses'),('project_manager','manage_quizzes'),
  ('project_manager','view_automations'),
  ('project_manager','view_finance_attachments'),('project_manager','upload_finance_attachments'),('project_manager','export_finance'),
  ('project_manager','mark_attendance'),('project_manager','export_attendance'),
  ('project_manager','import_participants'),('project_manager','export_participants'),('project_manager','manage_participant_points'),
  ('project_manager','send_bulk_notifications'),
  ('project_manager','export_reports'),
  ('project_manager','edit_own_profile'),
  ('project_manager','assign_tasks'),('project_manager','comment_tasks')
ON CONFLICT DO NOTHING;

-- Branch manager (subset of project manager)
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('branch_manager','view_branches'),
  ('branch_manager','view_guardians'),('branch_manager','manage_guardians'),
  ('branch_manager','view_courses'),
  ('branch_manager','view_finance_attachments'),('branch_manager','upload_finance_attachments'),
  ('branch_manager','mark_attendance'),('branch_manager','export_attendance'),
  ('branch_manager','export_participants'),('branch_manager','manage_participant_points'),
  ('branch_manager','export_reports'),
  ('branch_manager','edit_own_profile'),
  ('branch_manager','comment_tasks')
ON CONFLICT DO NOTHING;

-- Employee minimal
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('employee','view_dashboard'),
  ('employee','view_tasks'),('employee','comment_tasks'),
  ('employee','view_courses'),
  ('employee','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Participant
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('participant','view_courses'),
  ('participant','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Guardian
INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('guardian','edit_own_profile')
ON CONFLICT DO NOTHING;
