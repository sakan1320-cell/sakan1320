import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://inpfvfyrfhrgkrhbjrwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc'
);

const run = async () => {
  const sql = `
    UPDATE public.notification_templates SET meta_components = '{"body": ["guardian_name", "participant_name", "date", "project_name"]}'::jsonb WHERE key = 'late_alert';
    UPDATE public.notification_templates SET meta_components = '{"body": ["guardian_name", "participant_name", "date", "project_name"]}'::jsonb WHERE key = 'absence_alert';
    UPDATE public.notification_templates SET meta_components = '{"body": ["1", "2", "3"]}'::jsonb WHERE key = 'group_invite_link_concise';
    UPDATE public.notification_templates SET meta_components = '{"body": ["participant_name", "project_name", "date", "time"]}'::jsonb WHERE key = 'project_launch_notification';
    UPDATE public.notification_templates SET meta_components = '{"body": ["participant_name", "project_name", "group_link"]}'::jsonb WHERE key = 'group_invitation';
    UPDATE public.notification_templates SET meta_components = '{"body": ["guardian_name", "participant_name", "project_name", "date"]}'::jsonb WHERE key = 'attendance_absence_notice';
    UPDATE public.notification_templates SET meta_components = '{"body": ["project_name", "date", "time"]}'::jsonb WHERE key = 'closing_ceremony_invitation';
    UPDATE public.notification_templates SET meta_components = '{"body": ["participant_name", "project_name", "note"]}'::jsonb WHERE key = 'participant_note';
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL:', error);
  } else {
    console.log('meta_components updated successfully.');
  }
};

run();
