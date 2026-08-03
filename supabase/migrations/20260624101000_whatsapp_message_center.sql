-- 1. Modifying existing notification_templates
ALTER TABLE public.notification_templates 
ADD COLUMN IF NOT EXISTS manual_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 2. Create whatsapp_automation_settings
CREATE TABLE IF NOT EXISTS public.whatsapp_automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key TEXT NOT NULL REFERENCES public.notification_templates(key) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_event TEXT NOT NULL,
  target_audience TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_whatsapp_automations" ON public.whatsapp_automation_settings FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['executive','assistant','project_manager']::public.app_role[]));

GRANT ALL ON public.whatsapp_automation_settings TO service_role;
GRANT SELECT ON public.whatsapp_automation_settings TO authenticated;

DROP TRIGGER IF EXISTS set_updated_at ON public.whatsapp_automation_settings;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.whatsapp_automation_settings 
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Seed the templates
INSERT INTO public.notification_templates (key, name, channel, body_template, variables, manual_variables) VALUES
  ('project_launch_notification', 'إطلاق مشروع جديد', 'whatsapp', 'مرحباً بك في {project_name}، نود إعلامك: {note}', '["project_name"]'::jsonb, '["note"]'::jsonb),
  ('group_invitation', 'دعوة لمجموعة', 'whatsapp', 'مرحباً {participant_name}، تمت إضافتك لمجموعة. {note}', '["participant_name"]'::jsonb, '["note"]'::jsonb),
  ('session_reminder', 'تذكير بلقاء', 'whatsapp', 'نذكركم بلقاء {activity_title} بتاريخ {date}. رابط: {meeting_link}', '["activity_title", "date"]'::jsonb, '["meeting_link"]'::jsonb),
  ('same_day_reminder', 'تذكير بنفس اليوم', 'whatsapp', 'نذكركم بنشاط اليوم {activity_title} الساعة {time}.', '["activity_title", "time"]'::jsonb, '[]'::jsonb),
  ('activity_notification', 'إشعار نشاط', 'whatsapp', 'إشعار بخصوص {activity_title}: {custom_message}', '["activity_title"]'::jsonb, '["custom_message"]'::jsonb),
  ('attendance_absence_notice', 'إشعار غياب', 'whatsapp', 'المكرم {guardian_name}، نود إعلامكم بغياب {participant_name} بتاريخ {date}.', '["guardian_name", "participant_name", "date"]'::jsonb, '[]'::jsonb),
  ('late_arrival_notice', 'إشعار تأخر', 'whatsapp', 'المكرم {guardian_name}، تأخر {participant_name} اليوم.', '["guardian_name", "participant_name"]'::jsonb, '[]'::jsonb),
  ('session_feedback_request', 'طلب تقييم لقاء', 'whatsapp', 'نرجو تقييم لقاء {activity_title} عبر الرابط: {evaluation_link}', '["activity_title"]'::jsonb, '["evaluation_link"]'::jsonb),
  ('session_summary_share', 'ملخص لقاء', 'whatsapp', 'ملخص لقاء {activity_title}: {note}', '["activity_title"]'::jsonb, '["note"]'::jsonb),
  ('closing_ceremony_invitation', 'دعوة حفل ختامي', 'whatsapp', 'ندعوكم للحفل الختامي لمشروع {project_name}. المكان: {trip_location}', '["project_name"]'::jsonb, '["trip_location"]'::jsonb),
  ('participant_appreciation', 'شكر وتقدير', 'whatsapp', 'شكراً لجهودك {participant_name}. {custom_message}', '["participant_name"]'::jsonb, '["custom_message"]'::jsonb),
  ('guardian_notification', 'إشعار ولي أمر', 'whatsapp', 'عزيزي {guardian_name}، {custom_message}', '["guardian_name"]'::jsonb, '["custom_message"]'::jsonb),
  ('participant_note', 'ملاحظة مشارك', 'whatsapp', 'ملاحظة لـ {participant_name}: {note}', '["participant_name"]'::jsonb, '["note"]'::jsonb),
  ('external_trip_invitation', 'دعوة رحلة خارجية', 'whatsapp', 'رحلة إلى {trip_location} بتاريخ {date}.', '["date"]'::jsonb, '["trip_location"]'::jsonb),
  ('certificate_issued', 'إصدار شهادة', 'whatsapp', 'تهانينا {participant_name} لصدور شهادتك: {portal_link}', '["participant_name"]'::jsonb, '["portal_link"]'::jsonb),
  ('action_required_login', 'مطلوب إجراء', 'whatsapp', 'نرجو منكم الدخول: {required_action} عبر {portal_link}', '[]'::jsonb, '["required_action", "portal_link"]'::jsonb),
  ('group_invite_link_concise', 'دعوة مختصرة', 'whatsapp', 'انضم لمجموعتك: {group_link}', '[]'::jsonb, '["group_link"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET 
  manual_variables = EXCLUDED.manual_variables;
