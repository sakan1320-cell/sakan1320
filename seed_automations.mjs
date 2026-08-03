import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://inpfvfyrfhrgkrhbjrwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc'
);

const run = async () => {
  const sql = `
    INSERT INTO public.whatsapp_automation_settings 
      (template_key, is_active, trigger_event, target_audience, delay_minutes, conditions)
    VALUES
      ('absence_alert',  false, 'absence_recorded',       'guardian', 0, '{"status": "absent"}'),
      ('late_alert',     false, 'late_recorded',           'guardian', 0, '{"status": "late"}'),
      ('project_launch_notification', false, 'registration_accepted', 'participant', 0, '{}')
    ON CONFLICT DO NOTHING;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL:', error);
  } else {
    console.log('Automation settings seeded successfully.');
  }
};

run();
