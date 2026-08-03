import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://inpfvfyrfhrgkrhbjrwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc'
);

const run = async () => {
  const sql = `
    INSERT INTO public.notification_templates (key, name, channel, body_template, variables, manual_variables)
    VALUES
      ('late_alert', 'تأخر (ChakraHQ)', 'whatsapp', 'عزيزي {{guardian_name}}، نفيدكم بتأخر {{participant_name}} اليوم {{date}} في {{project_name}}. شكرًا لكم.', '["guardian_name", "participant_name", "project_name"]'::jsonb, '["date"]'::jsonb),
      ('absence_alert', 'غياب (ChakraHQ)', 'whatsapp', 'عزيزي {{guardian_name}}، نفيدكم بغياب {{participant_name}} اليوم {{date}} في {{project_name}}. شكرًا لكم.', '["guardian_name", "participant_name", "project_name"]'::jsonb, '["date"]'::jsonb),
      ('group_invite_link_concise', 'دعوة مجموعة (مختصرة)', 'whatsapp', 'تم تأكيد طلبك {{1}} مع {{2}}. يرجى الانضمام إلى مجموعة الواتساب لتبدأ: {{3}} شكرا لكم!', '[]'::jsonb, '["1", "2", "3"]'::jsonb),
      ('project_launch_notification', 'إطلاق مشروع', 'whatsapp', 'أهلًا {{participant_name}} يسرنا انضمامك إلى {{project_name}}. موعد الانطلاق: {{date}} {{time}}', '["participant_name", "project_name"]'::jsonb, '["date", "time"]'::jsonb),
      ('group_invitation', 'دعوة لمجموعة', 'whatsapp', 'مرحبًا {{participant_name}} تم إنشاء مجموعة التواصل الخاصة بـ {{project_name}}. رابط الانضمام: {{group_link}}', '["participant_name", "project_name"]'::jsonb, '["group_link"]'::jsonb),
      ('attendance_absence_notice', 'إشعار غياب', 'whatsapp', 'السلام عليكم {{guardian_name}} نحيطكم بعدم حضور: {{participant_name}} في {{project_name}} بتاريخ {{date}}', '["guardian_name", "participant_name", "project_name"]'::jsonb, '["date"]'::jsonb),
      ('closing_ceremony_invitation', 'دعوة حفل ختامي', 'whatsapp', 'ندعوك لحضور الحفل الختامي لـ {{project_name}} {{date}} {{time}}', '["project_name"]'::jsonb, '["date", "time"]'::jsonb),
      ('participant_note', 'ملاحظة مشارك', 'whatsapp', 'أهلًا {{participant_name}} وصلتنا ملاحظة تخص مشاركتك في {{project_name}}. الملاحظة: {{note}}', '["participant_name", "project_name"]'::jsonb, '["note"]'::jsonb)
    ON CONFLICT (key) DO UPDATE SET 
      variables = EXCLUDED.variables,
      manual_variables = EXCLUDED.manual_variables,
      body_template = EXCLUDED.body_template;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL:', error);
  } else {
    console.log('WhatsApp Templates Migration completed successfully.');
  }
};

run();
