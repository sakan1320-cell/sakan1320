-- ============================================================
-- Migration: LMS and Enterprise Core Schema Restoration
-- Timestamp: 20260516000003_lms_and_enterprise_fix
-- Purpose: Restore missing tables found in types but missing in DB
-- ============================================================

-- 0. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- 1. CORE LMS TABLES
CREATE TABLE IF NOT EXISTS public.lms_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  cover_url TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  pass_score INTEGER NOT NULL DEFAULT 60,
  points_reward INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  prerequisites JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.lms_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL, -- Fallback title
  title_ar TEXT,
  title_en TEXT,
  content TEXT,
  video_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,
  prerequisites JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_score INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  correct_index INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.lms_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled',
  progress INTEGER NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(course_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lms_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.lms_quizzes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  answers JSONB NOT NULL DEFAULT '{}',
  passed BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ADVANCED LMS (Found in Activator)
CREATE TABLE IF NOT EXISTS public.lms_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'assignment',
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  content JSONB DEFAULT '{}',
  max_points INTEGER DEFAULT 100,
  due_date TIMESTAMPTZ,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_activity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.lms_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submission_content JSONB DEFAULT '{}',
  attachment_urls JSONB DEFAULT '[]',
  grade NUMERIC,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  UNIQUE (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.lms_learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  course_ids JSONB DEFAULT '[]',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lms_instructor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  author_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ENTERPRISE TABLES (Found in Activator)
CREATE TABLE IF NOT EXISTS public.profile_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES auth.users(id),
  requested_changes JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  reviewer_id UUID REFERENCES auth.users(id),
  review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.participant_project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.project_branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'transferred', 'waitlisted')),
  enrollment_source TEXT DEFAULT 'manual' CHECK (enrollment_source IN ('manual', 'registration', 'import', 'transfer')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  archived_at TIMESTAMPTZ,
  UNIQUE (participant_id, project_id)
);

CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  thread_type TEXT NOT NULL DEFAULT 'direct',
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_thread_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  UNIQUE (thread_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. VIEWS
CREATE OR REPLACE VIEW public.lms_questions_public AS
SELECT id, quiz_id, question, options, order_index
FROM public.lms_questions;

GRANT SELECT ON public.lms_questions_public TO authenticated, anon;

-- 5. RLS (Simplified Admin-First Policies)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.tables 
           WHERE table_schema = 'public' AND table_name LIKE 'lms_%'
  LOOP
    EXECUTE 'ALTER TABLE public.' || t || ' ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "admin_all_' || t || '" ON public.' || t;
    EXECUTE 'CREATE POLICY "admin_all_' || t || '" ON public.' || t || ' FOR ALL USING (public.is_system_admin(auth.uid()) OR public.has_any_role(auth.uid(), ARRAY[''executive'', ''assistant'']))';
  END LOOP;
END $$;

-- 6. SPECIAL POLICIES
DROP POLICY IF EXISTS "users_own_enrollments" ON public.lms_enrollments;
CREATE POLICY "users_own_enrollments" ON public.lms_enrollments FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users_own_submissions" ON public.lms_activity_submissions;
CREATE POLICY "users_own_submissions" ON public.lms_activity_submissions FOR ALL USING (user_id = auth.uid());
DROP POLICY IF EXISTS "published_courses_visible" ON public.lms_courses;
CREATE POLICY "published_courses_visible" ON public.lms_courses FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "published_lessons_visible" ON public.lms_lessons;
CREATE POLICY "published_lessons_visible" ON public.lms_lessons FOR SELECT USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id AND c.is_published = true));
DROP POLICY IF EXISTS "members_view_threads" ON public.message_threads;
CREATE POLICY "members_view_threads" ON public.message_threads FOR SELECT USING (EXISTS (SELECT 1 FROM public.message_thread_members m WHERE m.thread_id = id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS "members_view_messages" ON public.messages;
CREATE POLICY "members_view_messages" ON public.messages FOR SELECT USING (EXISTS (SELECT 1 FROM public.message_thread_members m WHERE m.thread_id = thread_id AND m.user_id = auth.uid()));
DROP POLICY IF EXISTS "users_view_own_tickets" ON public.support_tickets;
CREATE POLICY "users_view_own_tickets" ON public.support_tickets FOR ALL USING (requester_id = auth.uid());

-- 7. GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
