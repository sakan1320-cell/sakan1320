import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://inpfvfyrfhrgkrhbjrwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc'
);

const run = async () => {
  const sql = `
    ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS whatsapp_automation_enabled BOOLEAN NOT NULL DEFAULT false;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Column whatsapp_automation_enabled added to projects table.');
  }
};

run();
