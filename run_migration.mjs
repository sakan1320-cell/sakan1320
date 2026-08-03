import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://inpfvfyrfhrgkrhbjrwn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlucGZ2ZnlyZmhyZ2tyaGJqcnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgxNTc5NCwiZXhwIjoyMDk0MzkxNzk0fQ._xedpdqGQeyRpghbvgF640HwMDH3a09Pv3p--sfcfkc'
);

const run = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.project_surveys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
      title_ar TEXT NOT NULL,
      title_en TEXT,
      description TEXT,
      is_template BOOLEAN NOT NULL DEFAULT false,
      fields JSONB NOT NULL DEFAULT '[]',
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.survey_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      survey_id UUID NOT NULL REFERENCES public.project_surveys(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      answers JSONB NOT NULL DEFAULT '{}',
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (survey_id, user_id)
    );

    ALTER TABLE public.project_surveys ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "admin_all_project_surveys" ON public.project_surveys;
    CREATE POLICY "admin_all_project_surveys" ON public.project_surveys FOR ALL USING (public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['executive', 'assistant']));
    
    DROP POLICY IF EXISTS "participants_read_surveys" ON public.project_surveys;
    CREATE POLICY "participants_read_surveys" ON public.project_surveys FOR SELECT USING (true);

    DROP POLICY IF EXISTS "admin_all_survey_responses" ON public.survey_responses;
    CREATE POLICY "admin_all_survey_responses" ON public.survey_responses FOR ALL USING (public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY['executive', 'assistant']));

    DROP POLICY IF EXISTS "users_own_survey_responses" ON public.survey_responses;
    CREATE POLICY "users_own_survey_responses" ON public.survey_responses FOR ALL USING (user_id = auth.uid());

    GRANT ALL ON public.project_surveys TO authenticated;
    GRANT ALL ON public.survey_responses TO authenticated;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Error executing SQL:', error);
  } else {
    console.log('Survey Migration completed successfully.');
  }
};

run();
