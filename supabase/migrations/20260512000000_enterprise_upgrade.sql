-- ============================================================
-- Migration: Sakansa Enterprise Features
-- Timestamp: 20260512_enterprise_upgrade
-- Scope: Profile edit requests, project memberships,
--        messaging, support tickets, LMS enhancements
-- ============================================================

-- ============================================================
-- 1. PROFILE EDIT REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  requester_id UUID REFERENCES auth.users(id),
  requested_changes JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  reviewer_id UUID REFERENCES auth.users(id),
  review_notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE public.profile_edit_requests ENABLE ROW LEVEL SECURITY;

-- Participants can see their own requests
DROP POLICY IF EXISTS "participants_view_own_edit_requests" ON public.profile_edit_requests;
CREATE POLICY "participants_view_own_edit_requests"
  ON public.profile_edit_requests FOR SELECT
  USING (requester_id = auth.uid());

-- Admins and executives can view and update all requests
DROP POLICY IF EXISTS "staff_manage_edit_requests" ON public.profile_edit_requests;
CREATE POLICY "staff_manage_edit_requests"
  ON public.profile_edit_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('executive', 'assistant', 'system_admin', 'board', 'project_manager', 'branch_manager')
    )
  );

-- Participants can insert their own requests
DROP POLICY IF EXISTS "participants_create_edit_requests" ON public.profile_edit_requests;
CREATE POLICY "participants_create_edit_requests"
  ON public.profile_edit_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- ============================================================
-- 2. PARTICIPANT PROJECT MEMBERSHIPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.participant_project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.project_branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'transferred', 'waitlisted')),
  enrollment_source TEXT DEFAULT 'manual'
    CHECK (enrollment_source IN ('manual', 'registration', 'import', 'transfer')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,
  transferred_to UUID REFERENCES public.projects(id),
  waitlist_position INTEGER,
  notes TEXT,
  UNIQUE (participant_id, project_id)
);

ALTER TABLE public.participant_project_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_memberships" ON public.participant_project_memberships;
CREATE POLICY "staff_manage_memberships"
  ON public.participant_project_memberships FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('executive', 'assistant', 'system_admin', 'board',
                     'project_manager', 'branch_manager', 'employee')
    )
  );

DROP POLICY IF EXISTS "participants_view_own_memberships" ON public.participant_project_memberships;
CREATE POLICY "participants_view_own_memberships"
  ON public.participant_project_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      WHERE p.id = participant_id AND p.auth_user_id = auth.uid()
    )
  );

-- Auto-index for performance
CREATE INDEX IF NOT EXISTS idx_ppm_participant ON public.participant_project_memberships(participant_id);
CREATE INDEX IF NOT EXISTS idx_ppm_project ON public.participant_project_memberships(project_id);
CREATE INDEX IF NOT EXISTS idx_ppm_status ON public.participant_project_memberships(status);

-- ============================================================
-- 3. PROJECT CAPACITY & REGISTRATION SETTINGS
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS capacity INTEGER,
  ADD COLUMN IF NOT EXISTS waitlist_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;

-- ============================================================
-- 4. INTERNAL MESSAGING SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS public.message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT,
  thread_type TEXT NOT NULL DEFAULT 'direct'
    CHECK (thread_type IN ('direct', 'project', 'broadcast')),
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

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thread_members_access" ON public.message_threads;
CREATE POLICY "thread_members_access"
  ON public.message_threads FOR ALL
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.message_thread_members
      WHERE thread_id = id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('system_admin', 'executive', 'assistant')
    )
  );

DROP POLICY IF EXISTS "thread_member_access" ON public.message_thread_members;
CREATE POLICY "thread_member_access"
  ON public.message_thread_members FOR ALL
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('system_admin', 'executive')
    )
  );

DROP POLICY IF EXISTS "messages_access" ON public.messages;
CREATE POLICY "messages_access"
  ON public.messages FOR ALL
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.message_thread_members
      WHERE thread_id = messages.thread_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('system_admin', 'executive')
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id, created_at DESC);

-- ============================================================
-- 5. SUPPORT TICKET SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'technical', 'billing', 'account', 'content', 'other')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  assignee_id UUID REFERENCES auth.users(id),
  internal_notes TEXT,
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.support_ticket_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_tickets" ON public.support_tickets;
CREATE POLICY "users_manage_own_tickets"
  ON public.support_tickets FOR ALL
  USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "staff_manage_all_tickets" ON public.support_tickets;
CREATE POLICY "staff_manage_all_tickets"
  ON public.support_tickets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('system_admin', 'executive', 'assistant', 'employee')
    )
  );

DROP POLICY IF EXISTS "users_view_own_ticket_replies" ON public.support_ticket_replies;
CREATE POLICY "users_view_own_ticket_replies"
  ON public.support_ticket_replies FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE id = ticket_id AND requester_id = auth.uid()
    )
    AND is_internal = false
  );

DROP POLICY IF EXISTS "staff_manage_ticket_replies" ON public.support_ticket_replies;
CREATE POLICY "staff_manage_ticket_replies"
  ON public.support_ticket_replies FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('system_admin', 'executive', 'assistant', 'employee')
    )
  );

CREATE INDEX IF NOT EXISTS idx_tickets_requester ON public.support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_replies ON public.support_ticket_replies(ticket_id, created_at);

-- ============================================================
-- 6. LMS ENHANCEMENTS
-- ============================================================
-- Course Modules (grouping lessons)
CREATE TABLE IF NOT EXISTS public.lms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  prerequisites JSONB DEFAULT '[]',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add module reference to lessons
ALTER TABLE public.lms_lessons
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES public.lms_modules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT '[]';

-- Activities (assignments, exercises)
CREATE TABLE IF NOT EXISTS public.lms_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL DEFAULT 'assignment'
    CHECK (activity_type IN ('assignment', 'exercise', 'project', 'discussion', 'quiz')),
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description TEXT,
  content JSONB DEFAULT '{}',
  max_points INTEGER DEFAULT 100,
  due_date TIMESTAMPTZ,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity Submissions
CREATE TABLE IF NOT EXISTS public.lms_activity_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.lms_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  submission_content JSONB DEFAULT '{}',
  attachment_urls JSONB DEFAULT '[]',
  grade NUMERIC,
  feedback TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'graded', 'returned')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id),
  UNIQUE (activity_id, user_id)
);

-- Learning Paths
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

-- Instructor Notes on participants
CREATE TABLE IF NOT EXISTS public.lms_instructor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id),
  author_id UUID NOT NULL REFERENCES auth.users(id),
  note TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for LMS new tables
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_activity_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_instructor_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lms_modules_published_visible" ON public.lms_modules;
CREATE POLICY "lms_modules_published_visible"
  ON public.lms_modules FOR SELECT USING (is_published = true OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant','project_manager','branch_manager','employee'))
  );

DROP POLICY IF EXISTS "staff_manage_lms_modules" ON public.lms_modules;
CREATE POLICY "staff_manage_lms_modules"
  ON public.lms_modules FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant','project_manager','branch_manager','employee'))
  );

DROP POLICY IF EXISTS "activities_visible_to_enrolled" ON public.lms_activities;
CREATE POLICY "activities_visible_to_enrolled"
  ON public.lms_activities FOR SELECT USING (true);

DROP POLICY IF EXISTS "staff_manage_activities" ON public.lms_activities;
CREATE POLICY "staff_manage_activities"
  ON public.lms_activities FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant','project_manager','branch_manager','employee'))
  );

DROP POLICY IF EXISTS "users_own_submissions" ON public.lms_activity_submissions;
CREATE POLICY "users_own_submissions"
  ON public.lms_activity_submissions FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_view_submissions" ON public.lms_activity_submissions;
CREATE POLICY "staff_view_submissions"
  ON public.lms_activity_submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant','project_manager','branch_manager','employee'))
  );

DROP POLICY IF EXISTS "staff_grade_submissions" ON public.lms_activity_submissions;
CREATE POLICY "staff_grade_submissions"
  ON public.lms_activity_submissions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant','project_manager','branch_manager','employee'))
  );

DROP POLICY IF EXISTS "learning_paths_visible" ON public.lms_learning_paths;
CREATE POLICY "learning_paths_visible"
  ON public.lms_learning_paths FOR SELECT USING (is_published = true OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant'))
  );

DROP POLICY IF EXISTS "staff_manage_learning_paths" ON public.lms_learning_paths;
CREATE POLICY "staff_manage_learning_paths"
  ON public.lms_learning_paths FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive','assistant'))
  );

DROP POLICY IF EXISTS "instructor_notes_access" ON public.lms_instructor_notes;
CREATE POLICY "instructor_notes_access"
  ON public.lms_instructor_notes FOR ALL USING (
    author_id = auth.uid()
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('system_admin','executive'))
  );

-- ============================================================
-- 7. NOTIFICATIONS IMPROVEMENTS
-- ============================================================
-- Add user_id FK to notifications for in-app targeting
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS action_url TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(target_user_id, is_read);

-- ============================================================
-- 8. ADD MANAGE_HOMEPAGE PERMISSION IF NOT EXISTS
-- ============================================================
INSERT INTO public.permissions (key, label_ar, label_en, category)
VALUES
  ('manage_homepage', 'إدارة الصفحة الرئيسية', 'Manage Homepage', 'system'),
  ('manage_messages', 'إدارة الرسائل', 'Manage Messages', 'communication'),
  ('manage_tickets', 'إدارة تذاكر الدعم', 'Manage Support Tickets', 'communication'),
  ('view_messages', 'عرض الرسائل', 'View Messages', 'communication'),
  ('view_support', 'عرض الدعم الفني', 'View Support', 'communication'),
  ('manage_lms_advanced', 'إدارة نظام التعلم المتقدم', 'Manage Advanced LMS', 'education'),
  ('grade_activities', 'تقييم الأنشطة', 'Grade Activities', 'education')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 9. FUNCTION: Auto-create membership when participant added to project
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_create_project_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- When a participant has a project_id set, create a membership record
  IF NEW.project_id IS NOT NULL AND (OLD.project_id IS NULL OR OLD.project_id <> NEW.project_id) THEN
    INSERT INTO public.participant_project_memberships (
      participant_id, project_id, branch_id, status, enrollment_source
    ) VALUES (
      NEW.id, NEW.project_id, NEW.branch_id, 'active', 'manual'
    ) ON CONFLICT (participant_id, project_id) DO UPDATE
      SET status = 'active', branch_id = EXCLUDED.branch_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_membership ON public.participants;
CREATE TRIGGER trg_auto_membership
  AFTER INSERT OR UPDATE OF project_id ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_project_membership();

-- ============================================================
-- 10. FUNCTION: Get unread message count for user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unread_message_count(_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.messages m
  JOIN public.message_thread_members mtm ON mtm.thread_id = m.thread_id AND mtm.user_id = _user_id
  WHERE m.sender_id <> _user_id
    AND (mtm.last_read_at IS NULL OR m.created_at > mtm.last_read_at)
    AND m.is_deleted = false;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 11. FUNCTION: Get unread notification count for user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE target_user_id = _user_id AND is_read = false;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_participants_auth_user ON public.participants(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_participants_project ON public.participants(project_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_participant ON public.profile_edit_requests(participant_id);
CREATE INDEX IF NOT EXISTS idx_profile_edit_requests_status ON public.profile_edit_requests(status);
